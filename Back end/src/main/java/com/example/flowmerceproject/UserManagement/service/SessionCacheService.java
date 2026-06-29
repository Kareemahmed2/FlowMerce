package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;

/**
 * Two-tier Redis session cache for JwtAuthFilter.
 *
 * Tier 1  flowmerce:sess:{hash}      → role string   TTL=30s  (sliding)
 * Tier 2  flowmerce:sess:etag:{hash} → role string   TTL=24h  (long-lived fallback)
 *
 * Tier 1 hit:  0 DB queries — role served directly from Redis.
 * Tier 2 hit:  1 DB query  — existsByTokenAndIsRevokedFalse; if active, restore Tier 1 with cached role.
 * Both miss:   2 DB queries — existing behaviour; result stored in both tiers.
 *
 * All operations fail-open so Redis unavailability never blocks auth.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionCacheService {

    private final StringRedisTemplate redis;
    private final SessionRepository sessionRepository;

    @Value("${session.cache.ttl-seconds:30}")
    private long tier1TtlSeconds;

    @Value("${session.cache.etag-ttl-seconds:86400}")
    private long tier2TtlSeconds;

    public static final String TIER1_PREFIX = "flowmerce:sess:";
    public static final String TIER2_PREFIX = "flowmerce:sess:etag:";

    // ── HASH ──────────────────────────────────────────────────────────────────

    /** SHA-256(token), first 24 hex chars (96 bits — collision-safe for this scale). */
    public String hash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 24);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    // ── TIER 1 ────────────────────────────────────────────────────────────────

    /**
     * Returns the cached role if present (refreshing the sliding TTL), or null on miss/error.
     */
    public String tryGetRole(String hash) {
        try {
            String key = TIER1_PREFIX + hash;
            String role = redis.opsForValue().get(key);
            if (role != null) {
                redis.expire(key, Duration.ofSeconds(tier1TtlSeconds));
            }
            return role;
        } catch (Exception e) {
            log.warn("Session tier1 read failed for hash {}: {}", hash, e.getMessage());
            return null;
        }
    }

    /** Restore tier-1 from tier-2 data after a successful revalidation. */
    public void restoreTier1(String hash, String role) {
        try {
            redis.opsForValue().set(TIER1_PREFIX + hash, role, Duration.ofSeconds(tier1TtlSeconds));
        } catch (Exception e) {
            log.warn("Session tier1 restore failed for hash {}: {}", hash, e.getMessage());
        }
    }

    // ── TIER 2 ────────────────────────────────────────────────────────────────

    /** Returns the role stored in tier-2, or null on miss/error. */
    public String tryGetTier2Role(String hash) {
        try {
            return redis.opsForValue().get(TIER2_PREFIX + hash);
        } catch (Exception e) {
            log.warn("Session tier2 read failed for hash {}: {}", hash, e.getMessage());
            return null;
        }
    }

    // ── STORE / EVICT ─────────────────────────────────────────────────────────

    /** Write role to both tiers (each write is individually fail-open). */
    public void store(String hash, String role) {
        try {
            redis.opsForValue().set(TIER1_PREFIX + hash, role, Duration.ofSeconds(tier1TtlSeconds));
        } catch (Exception e) {
            log.warn("Session tier1 write failed for hash {}: {}", hash, e.getMessage());
        }
        try {
            redis.opsForValue().set(TIER2_PREFIX + hash, role, Duration.ofSeconds(tier2TtlSeconds));
        } catch (Exception e) {
            log.warn("Session tier2 write failed for hash {}: {}", hash, e.getMessage());
        }
    }

    /** Evict both tiers for the given raw JWT token. */
    public void evict(String token) {
        evictByHash(hash(token));
    }

    /** Evict both tiers when only the hash is known (e.g. inside the filter). */
    public void evictByHash(String hash) {
        try {
            redis.delete(TIER1_PREFIX + hash);
        } catch (Exception e) {
            log.warn("Session tier1 evict failed for hash {}: {}", hash, e.getMessage());
        }
        try {
            redis.delete(TIER2_PREFIX + hash);
        } catch (Exception e) {
            log.warn("Session tier2 evict failed for hash {}: {}", hash, e.getMessage());
        }
    }

    /**
     * Evict both tiers for all active sessions of a user.
     * Call BEFORE revokeAllByUserId so the tokens are still queryable.
     */
    public void evictAllForUser(Integer userId) {
        List<String> tokens;
        try {
            tokens = sessionRepository.findActiveTokensByUserId(userId);
        } catch (Exception e) {
            log.warn("Could not fetch active tokens for user {} before eviction: {}", userId, e.getMessage());
            return;
        }
        for (String token : tokens) {
            evict(token);
        }
    }
}

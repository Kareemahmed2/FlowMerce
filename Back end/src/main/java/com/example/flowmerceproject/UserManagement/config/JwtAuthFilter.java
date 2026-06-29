package com.example.flowmerceproject.UserManagement.config;

import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.example.flowmerceproject.UserManagement.service.SessionCacheService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Two-tier Redis session cache sits in front of the DB checks.
 *
 * Tier 1 hit  (within 30 s window):  0 DB queries — role from Redis
 * Tier 2 hit  (long-lived fallback):  1 DB query  — existsByTokenAndIsRevokedFalse
 *   └ active → restore Tier 1, authenticate with cached role
 *   └ revoked / missing → evict Tier 2, reject
 * Full load   (both misses):          2 DB queries — existing behavior, then populate both tiers
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final SessionRepository sessionRepository;
    // SEC-10: live role reload on full-load path so role changes propagate within TTL.
    private final UserRepository userRepository;
    private final SessionCacheService sessionCacheService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // ── 1. Extract token ─────────────────────────────────────────────────
        // SEC-6 / SEC-11: prefer Authorization header; fall back to scoped cookies.
        String token = null;
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ") && !authHeader.substring(7).isBlank()) {
            token = authHeader.substring(7);
        }

        if (token == null) {
            String roleHint = request.getHeader("X-Auth-Role");
            if ("CUSTOMER".equalsIgnoreCase(roleHint)) {
                token = CookieUtil.extractAccessToken(request, CookieUtil.CUSTOMER_SCOPE);
            } else if ("MERCHANT".equalsIgnoreCase(roleHint)) {
                token = CookieUtil.extractAccessToken(request, CookieUtil.MERCHANT_SCOPE);
            } else {
                token = CookieUtil.extractAccessToken(request, CookieUtil.MERCHANT_SCOPE);
                if (token == null) {
                    token = CookieUtil.extractAccessToken(request, CookieUtil.CUSTOMER_SCOPE);
                }
            }
        }

        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        // ── 2. JWT signature + expiry (in-memory, no DB) ─────────────────────
        if (!jwtUtil.isTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtUtil.extractEmail(token);
        String hash  = sessionCacheService.hash(token);

        // ── 3. Tier-1 hit: 0 DB queries ──────────────────────────────────────
        String cachedRole = sessionCacheService.tryGetRole(hash);
        if (cachedRole != null) {
            authenticate(email, cachedRole);
            filterChain.doFilter(request, response);
            return;
        }

        // ── 4. Tier-2 hit: 1 DB query ────────────────────────────────────────
        String tier2Role = sessionCacheService.tryGetTier2Role(hash);
        if (tier2Role != null) {
            if (!sessionRepository.existsByTokenAndIsRevokedFalse(token)) {
                sessionCacheService.evictByHash(hash);
                filterChain.doFilter(request, response);
                return;
            }
            sessionCacheService.restoreTier1(hash, tier2Role);
            authenticate(email, tier2Role);
            filterChain.doFilter(request, response);
            return;
        }

        // ── 5. Full load: 2 DB queries (existing behavior) ───────────────────
        if (!sessionRepository.existsByTokenAndIsRevokedFalse(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        // SEC-10: read live role from DB so a role change propagates within the cache TTL.
        String role = userRepository.findByEmail(email)
                .map(u -> u.getRole().name())
                .orElse(jwtUtil.extractRole(token));

        sessionCacheService.store(hash, role);
        authenticate(email, role);
        filterChain.doFilter(request, response);
    }

    private void authenticate(String email, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        email,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                )
        );
    }
}

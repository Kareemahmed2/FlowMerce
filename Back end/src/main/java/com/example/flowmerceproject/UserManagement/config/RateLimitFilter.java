package com.example.flowmerceproject.UserManagement.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;

/**
 * Simple Redis-backed sliding-window rate limiter.
 *
 * Limits applied per-IP:
 *  - /auth/**      → 30 requests / 60s  (login/register brute-force protection)
 *  - /uploads/**   → 20 requests / 60s  (upload abuse protection)
 *  - All other     → 300 requests / 60s (general API protection)
 *
 * Uses Redis INCR + EXPIRE so the counter resets automatically.
 * On Redis failure the filter fails-open (logs warning, allows request).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;

    // Sensitive endpoints — tight limit
    private static final int AUTH_LIMIT    = 30;
    private static final int UPLOAD_LIMIT  = 20;
    // General API — loose limit
    private static final int GLOBAL_LIMIT  = 300;
    private static final Duration WINDOW   = Duration.ofSeconds(60);

    /** Paths that get the tight auth rate limit. */
    private static final Set<String> AUTH_PREFIXES = Set.of(
            "/auth/merchant/login",
            "/auth/customer/login",
            "/auth/merchant/register",
            "/auth/customer/register",
            "/auth/merchant/forgot-password",
            "/auth/customer/forgot-password"
    );

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        // CORS preflight carries no credentials/payload and SecurityConfig already
        // permits it unconditionally — it shouldn't depend on Redis being healthy
        // or count against anyone's rate limit. A slow Redis call here was stalling
        // preflight responses, which made even "permitAll" endpoints look hung.
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain
    ) throws ServletException, IOException {

        String ip  = resolveIp(request);
        String path = request.getServletPath();
        int limit = resolveLimit(path);
        String key = "rl:" + ip + ":" + bucket(path);

        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1) {
                // First request in this window — set expiry
                redis.expire(key, WINDOW);
            }
            if (count != null && count > limit) {
                log.warn("Rate limit exceeded: ip={} path={} count={}", ip, path, count);
                response.setStatus(429);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write(
                    "{\"success\":false,\"message\":\"Too many requests. Please slow down.\",\"status\":429}"
                );
                return;
            }
        } catch (Exception ex) {
            // Fail-open: if Redis is unavailable, allow the request
            log.warn("RateLimitFilter: Redis error (fail-open) — {}", ex.getMessage());
        }

        chain.doFilter(request, response);
    }

    private int resolveLimit(String path) {
        for (String prefix : AUTH_PREFIXES) {
            if (path.startsWith(prefix)) return AUTH_LIMIT;
        }
        if (path.startsWith("/uploads")) return UPLOAD_LIMIT;
        return GLOBAL_LIMIT;
    }

    /** Bucket name: group similar paths so the key doesn't explode. */
    private static String bucket(String path) {
        if (path.startsWith("/auth"))    return "auth";
        if (path.startsWith("/uploads")) return "uploads";
        return "api";
    }

    private static String resolveIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real;
        return req.getRemoteAddr();
    }
}

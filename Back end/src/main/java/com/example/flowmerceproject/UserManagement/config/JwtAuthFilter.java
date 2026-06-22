package com.example.flowmerceproject.UserManagement.config;

import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final SessionRepository sessionRepository;
    // SEC-10: used for per-request role recheck so a role change takes effect
    // immediately without waiting for the token to expire (24h window).
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // SEC-6 / SEC-11: prefer the Authorization header when present — it reflects
        // exactly which auth context (merchant vs customer) made this specific call,
        // and stays correct even if the *other* context's cookie was set more recently
        // in the same browser. Cookies are namespaced per scope via X-Auth-Role so a
        // merchant dashboard session and a customer storefront session in the same
        // browser don't clobber each other; fall back to checking both scopes when
        // there's no hint (e.g. a caller that doesn't send the header).
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

        // Validate JWT signature and expiry
        if (!jwtUtil.isTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check token is not revoked in DB (logout support)
        if (!sessionRepository.existsByTokenAndIsRevokedFalse(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtUtil.extractEmail(token);

        // SEC-10: read the live role from the DB rather than trusting the JWT claim —
        // a role change (e.g. admin revokes merchant status) is enforced on the next
        // request instead of waiting up to 24h for the token to expire.
        String role = userRepository.findByEmail(email)
                .map(u -> u.getRole().name())
                .orElse(jwtUtil.extractRole(token));

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        email,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }
}
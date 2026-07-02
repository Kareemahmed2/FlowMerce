package com.example.flowmerceproject.UserManagement.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import org.springframework.http.HttpMethod;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    /** DOC-6: CORS origin driven by app.frontend-url instead of hardcoded localhost. */
    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Fix: return 401 (Unauthorized) for unauthenticated requests,
                // not 403 (Forbidden). Spring Security defaults to 403 for both.
                .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) -> {
                        response.setStatus(401);
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        response.getWriter().write(
                            "{\"success\":false,\"message\":\"Authentication required.\",\"status\":401,\"code\":\"UNAUTHORIZED\"}"
                        );
                    })
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/auth/social/*/redirect",
                                "/auth/social/*/callback",
                                "/auth/merchant/register",
                                "/auth/merchant/login",
                                "/auth/merchant/activate",
                                "/auth/merchant/forgot-password",
                                "/auth/merchant/reset-password",
                                "/auth/merchant/refresh",
                                "/auth/merchant/2fa/verify",
                                "/auth/merchant/2fa/resend",
                                "/auth/customer/register",
                                "/auth/customer/login",
                                "/auth/customer/activate",
                                "/auth/customer/forgot-password",
                                "/auth/customer/reset-password",
                                "/auth/customer/refresh",
                                "/auth/activate",
                                "/auth/reset-password",
                                "/actuator/health",
                                "/public/**",
                                "/categories",
                                "/categories/**",
                                "/stores/slug/**",
                                "/stores/*/products/public",
                                "/stores/*/products/search",
                                "/stores/*/products/*",
                                "/products/*/reviews",
                                "/uploads/**"
                        ).permitAll()
                        .requestMatchers("/stream/private").authenticated()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(rateLimitFilter, JwtAuthFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // DOC-6: always allow the configured frontend origin + *.flowmerce.io.
        // In dev frontendUrl = http://localhost:3000; in prod override via FRONTEND_URL.
        config.setAllowedOriginPatterns(List.of(
                frontendUrl,
                "http://localhost:[*]",
                "https://*.flowmerce.io"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}

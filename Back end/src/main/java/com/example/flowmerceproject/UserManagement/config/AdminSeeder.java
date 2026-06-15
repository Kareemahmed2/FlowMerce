package com.example.flowmerceproject.UserManagement.config;

import com.example.flowmerceproject.UserManagement.entity.Role;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Seeds a single ADMIN user on application startup.
 *
 * - Idempotent: does nothing if an account with the configured email already exists.
 * - Credentials come from configuration (env-overridable), never hardcoded:
 *     app.admin.email    (default admin@flowmerce.com)
 *     app.admin.password (default ChangeMe!2026 — override via ADMIN_PASSWORD in prod)
 *
 * Authorization keys off users.role (read into the JWT on login), so creating
 * just the User row with role=ADMIN is sufficient for both login and hasRole('ADMIN').
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminSeeder implements CommandLineRunner {

    /** SEC-7: the insecure built-in default that must never reach production. */
    private static final String DEFAULT_ADMIN_PASSWORD = "ChangeMe!2026";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Value("${app.admin.email:admin@flowmerce.com}")
    private String adminEmail;

    @Value("${app.admin.password:ChangeMe!2026}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        // SEC-7: refuse to boot in production with the default admin password.
        boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (isProd && DEFAULT_ADMIN_PASSWORD.equals(adminPassword)) {
            throw new IllegalStateException(
                    "Refusing to start: ADMIN_PASSWORD is still the built-in default in the 'prod' profile. "
                            + "Set a strong ADMIN_PASSWORD environment variable.");
        }

        if (userRepository.findByEmail(adminEmail).isPresent()) {
            log.info("Admin account already present ({}). Skipping seed.", adminEmail);
            return;
        }

        User admin = User.builder()
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .fullName("Platform Admin")
                .phone(null)
                .role(Role.ADMIN)
                .isActive(true)        // bypass the activation check so login works immediately
                .isMfaEnabled(false)
                .build();

        userRepository.save(admin);
        log.info("Seeded ADMIN account: {}", adminEmail);
    }
}

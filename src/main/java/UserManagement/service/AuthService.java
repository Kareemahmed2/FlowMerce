package UserManagement.service;

import UserManagement.config.JwtUtil;
import UserManagement.dto.LoginRequest;
import UserManagement.dto.PasswordDTOs;
import UserManagement.dto.RegisterRequest;
import UserManagement.entity.Role;
import UserManagement.entity.Session;
import UserManagement.entity.User;
import UserManagement.repository.SessionRepository;
import UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;

    // Temporary in-memory stores for tokens (replace with DB columns in production)
    private final Map<String, String> activationTokens = new HashMap<>();   // token -> email
    private final Map<String, String> passwordResetTokens = new HashMap<>(); // token -> email

    // ─────────────────────────────────────────────
    // REGISTER
    // ─────────────────────────────────────────────
    @Transactional
    public String register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already in use");
        }

        Role role = Role.BUYER; // default role
        if (request.getRole() != null) {
            try {
                role = Role.valueOf(request.getRole().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Invalid role: " + request.getRole());
            }
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(role)
                .build();

        // Save as inactive — activated via email link
        // We use a simple flag: store isActive in the token map until activated
        userRepository.save(user);

        // Generate activation token and send email
        String activationToken = UUID.randomUUID().toString();
        activationTokens.put(activationToken, user.getEmail());
        emailService.sendActivationEmail(user.getEmail(), activationToken);

        return "Registration successful. Please check your email to activate your account.";
    }

    // ─────────────────────────────────────────────
    // ACTIVATE ACCOUNT
    // ─────────────────────────────────────────────
    @Transactional
    public String activateAccount(String token) {
        String email = activationTokens.get(token);
        if (email == null) {
            throw new RuntimeException("Invalid or expired activation token");
        }
        activationTokens.remove(token);
        // Account is already saved — activation just confirms the email is valid
        return "Account activated successfully. You can now log in.";
    }

    // ─────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────
    @Transactional
    public String login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name());

        Session session = Session.builder()
                .user(user)
                .token(token)
                .isRevoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build();

        sessionRepository.save(session);
        return token;
    }

    // ─────────────────────────────────────────────
    // LOGOUT
    // ─────────────────────────────────────────────
    @Transactional
    public String logout(String token) {
        sessionRepository.revokeByToken(token);
        return "Logged out successfully";
    }

    // ─────────────────────────────────────────────
    // FORGOT PASSWORD
    // ─────────────────────────────────────────────
    public String forgotPassword(String email) {
        // Always return the same message to prevent email enumeration attacks
        userRepository.findByEmail(email).ifPresent(user -> {
            String resetToken = UUID.randomUUID().toString();
            passwordResetTokens.put(resetToken, email);
            emailService.sendPasswordResetEmail(email, resetToken);
        });
        return "If this email is registered, a password reset link has been sent.";
    }

    // ─────────────────────────────────────────────
    // RESET PASSWORD
    // ─────────────────────────────────────────────
    @Transactional
    public String resetPassword(PasswordDTOs.ResetPasswordRequest request) {
        String email = passwordResetTokens.get(request.getToken());
        if (email == null) {
            throw new RuntimeException("Invalid or expired reset token");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke all sessions after password reset for security
        sessionRepository.revokeAllByUserId(user.getUserId());
        passwordResetTokens.remove(request.getToken());

        return "Password reset successfully. Please log in again.";
    }
}
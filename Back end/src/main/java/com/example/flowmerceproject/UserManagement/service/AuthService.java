package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.UserManagement.config.JwtUtil;
import com.example.flowmerceproject.UserManagement.dto.AuthResponse;
import com.example.flowmerceproject.UserManagement.dto.LoginRequest;
import com.example.flowmerceproject.UserManagement.dto.PasswordDTOs;
import com.example.flowmerceproject.UserManagement.dto.RegisterRequest;
import com.example.flowmerceproject.UserManagement.dto.UserResponse;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.Role;
import com.example.flowmerceproject.UserManagement.entity.Session;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.entity.VerificationToken;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.exception.UnauthorizedException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.example.flowmerceproject.UserManagement.repository.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final MerchantRepository merchantRepository;
    private final SessionRepository sessionRepository;
    private final VerificationTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;

    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    // ── REGISTER ──────────────────────────────────────────────────────────────

    @Transactional
    public String register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email is already registered: " + request.getEmail());
        }

        // Merchant registration endpoint always creates MERCHANT role
        Role role = Role.MERCHANT;

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(role)
                .build();

        userRepository.save(user);

        merchantRepository.save(Merchant.builder()
                .user(user)
                .businessName(request.getBusinessName())
                .build());

        String activationToken = UUID.randomUUID().toString();
        tokenRepository.deleteByEmailAndType(user.getEmail(), VerificationToken.TokenType.ACTIVATION);
        tokenRepository.save(VerificationToken.builder()
                .token(activationToken)
                .email(user.getEmail())
                .type(VerificationToken.TokenType.ACTIVATION)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build());

        emailService.sendActivationEmail(user.getEmail(), activationToken);
        return "Registration successful. Please check your email to activate your account.";
    }

    // ── ACTIVATE ──────────────────────────────────────────────────────────────

    @Transactional
    public String activateAccount(String token) {
        VerificationToken vt = tokenRepository
                .findByTokenAndTypeAndUsedFalse(token, VerificationToken.TokenType.ACTIVATION)
                .orElseThrow(() -> new BadRequestException("Invalid or expired activation token."));

        if (vt.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Activation token has expired.");
        }

        vt.setUsed(true);
        tokenRepository.save(vt);

        User user = userRepository.findByEmail(vt.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setIsActive(true);
        userRepository.save(user);

        return "Account activated successfully. You can now log in.";
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        if (!user.getIsActive()) {
            throw new UnauthorizedException(
                "Account is not activated. Please check your email for the activation link.");
        }

        String accessToken = jwtUtil.generateToken(user.getEmail(), user.getRole().name());

        Session accessSession = Session.builder()
                .user(user)
                .token(accessToken)
                .isRevoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusSeconds(jwtExpirationMs / 1000))
                .build();
        sessionRepository.save(accessSession);

        String refreshToken = UUID.randomUUID().toString();
        Session refreshSession = Session.builder()
                .user(user)
                .token(refreshToken)
                .isRevoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(30))
                .build();
        sessionRepository.save(refreshSession);

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    // ── REFRESH ───────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse refreshToken(String token) {
        Session refreshSession = sessionRepository.findByTokenAndIsRevokedFalse(token)
                .orElseThrow(() -> new UnauthorizedException("Invalid or revoked refresh token"));

        if (refreshSession.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new UnauthorizedException("Refresh token has expired");
        }

        // SEC-8: single-use refresh tokens — revoke the old one immediately
        // so a stolen refresh token can only be used once.
        refreshSession.setIsRevoked(true);
        sessionRepository.save(refreshSession);

        User user = refreshSession.getUser();

        // Issue new access token
        String newAccessToken = jwtUtil.generateToken(user.getEmail(), user.getRole().name());
        sessionRepository.save(Session.builder()
                .user(user)
                .token(newAccessToken)
                .isRevoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusSeconds(jwtExpirationMs / 1000))
                .build());

        // Issue NEW refresh token (rotation)
        String newRefreshToken = UUID.randomUUID().toString();
        sessionRepository.save(Session.builder()
                .user(user)
                .token(newRefreshToken)
                .isRevoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(30))
                .build());

        return buildAuthResponse(user, newAccessToken, newRefreshToken);
    }

    // ── LOGOUT ────────────────────────────────────────────────────────────────

    @Transactional
    public String logout(String token) {
        if (!sessionRepository.existsByTokenAndIsRevokedFalse(token)) {
            throw new BadRequestException("Token is already revoked or does not exist.");
        }
        sessionRepository.revokeByToken(token);
        return "Logged out successfully.";
    }

    // ── GET CURRENT USER ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return UserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .build();
    }

    // ── FORGOT PASSWORD ───────────────────────────────────────────────────────

    @Transactional
    public String forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String resetToken = UUID.randomUUID().toString();
            tokenRepository.deleteByEmailAndType(email, VerificationToken.TokenType.PASSWORD_RESET);
            tokenRepository.save(VerificationToken.builder()
                    .token(resetToken)
                    .email(email)
                    .type(VerificationToken.TokenType.PASSWORD_RESET)
                    .expiresAt(LocalDateTime.now().plusHours(1))
                    .build());
            emailService.sendPasswordResetEmail(email, resetToken);
        });
        return "If this email is registered, a password reset link has been sent.";
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────

    @Transactional
    public String resetPassword(PasswordDTOs.ResetPasswordRequest request) {
        VerificationToken vt = tokenRepository
                .findByTokenAndTypeAndUsedFalse(request.getToken(), VerificationToken.TokenType.PASSWORD_RESET)
                .orElseThrow(() -> new BadRequestException("Invalid or expired password reset token."));

        if (vt.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Password reset token has expired.");
        }

        if (!request.getNewPassword().equals(request.getConfirmNewPassword())) {
            throw new BadRequestException("New password and confirm password do not match");
        }

        User user = userRepository.findByEmail(vt.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from old password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        vt.setUsed(true);
        tokenRepository.save(vt);

        sessionRepository.revokeAllByUserId(user.getUserId());
        return "Password reset successfully. Please log in again.";
    }

    // ── CUSTOMER REGISTER ─────────────────────────────────────────────────────

    @Transactional
    public String registerCustomer(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email is already registered: " + request.getEmail());
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(Role.BUYER)
                .build();
        userRepository.save(user);

        customerRepository.save(Customer.builder().user(user).build());

        String activationToken = UUID.randomUUID().toString();
        tokenRepository.deleteByEmailAndType(user.getEmail(), VerificationToken.TokenType.ACTIVATION);
        tokenRepository.save(VerificationToken.builder()
                .token(activationToken)
                .email(user.getEmail())
                .type(VerificationToken.TokenType.ACTIVATION)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build());

        // If the customer registered from a store page, send the store-branded
        // activation email that links back to /store/{slug}/activate.
        // Otherwise fall back to the generic /activate page.
        if (request.getStoreSlug() != null && !request.getStoreSlug().isBlank()) {
            emailService.sendCustomerActivationEmail(user.getEmail(), activationToken, request.getStoreSlug());
        } else {
            emailService.sendActivationEmail(user.getEmail(), activationToken);
        }
        return "Registration successful. Please check your email to activate your account.";
    }

    // ── CUSTOMER DELETE ACCOUNT ───────────────────────────────────────────────

    @Transactional
    public String deleteCustomerAccount(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        customerRepository.findByUser_UserId(user.getUserId())
                .ifPresent(customerRepository::delete);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
        return "Account deleted successfully.";
    }

    // ── HELPER ────────────────────────────────────────────────────────────────

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtExpirationMs)
                .user(AuthResponse.UserInfo.builder()
                        .userId(user.getUserId())
                        .fullName(user.getFullName())
                        .email(user.getEmail())
                        .role(user.getRole().name())
                        .createdAt(user.getCreatedAt())
                        .build())
                .build();
    }
}

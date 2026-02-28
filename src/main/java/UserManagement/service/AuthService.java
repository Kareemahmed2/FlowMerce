package UserManagement.service;

import UserManagement.config.JwtUtil;
import UserManagement.dto.LoginRequest;
import UserManagement.dto.PasswordDTOs;
import UserManagement.dto.RegisterRequest;
import UserManagement.entity.Role;
import UserManagement.entity.Session;
import UserManagement.entity.User;
import UserManagement.exception.BadRequestException;
import UserManagement.exception.ConflictException;
import UserManagement.exception.UnauthorizedException;
import UserManagement.exception.ResourceNotFoundException;
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

    private final Map<String, String> activationTokens = new HashMap<>();
    private final Map<String, String> passwordResetTokens = new HashMap<>();

    @Transactional
    public String register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email is already registered: " + request.getEmail());
        }

        Role role = Role.BUYER;
        if (request.getRole() != null) {
            try {
                role = Role.valueOf(request.getRole().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Invalid role: " + request.getRole()
                        + ". Valid values are: ADMIN, MERCHANT, BUYER, GUEST");
            }
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(role)
                .build();

        userRepository.save(user);

        String activationToken = UUID.randomUUID().toString();
        activationTokens.put(activationToken, user.getEmail());
        emailService.sendActivationEmail(user.getEmail(), activationToken);

        return "Registration successful. Please check your email to activate your account.";
    }

    @Transactional
    public String activateAccount(String token) {
        String email = activationTokens.get(token);
        if (email == null) {
            throw new BadRequestException("Invalid or expired activation token.");
        }
        activationTokens.remove(token);
        return "Account activated successfully. You can now log in.";
    }

    @Transactional
    public String login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
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

    @Transactional
    public String logout(String token) {
        if (!sessionRepository.existsByTokenAndIsRevokedFalse(token)) {
            throw new BadRequestException("Token is already revoked or does not exist.");
        }
        sessionRepository.revokeByToken(token);
        return "Logged out successfully.";
    }

    public String forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String resetToken = UUID.randomUUID().toString();
            passwordResetTokens.put(resetToken, email);
            emailService.sendPasswordResetEmail(email, resetToken);
        });
        return "If this email is registered, a password reset link has been sent.";
    }

    @Transactional
    public String resetPassword(PasswordDTOs.ResetPasswordRequest request) {
        String email = passwordResetTokens.get(request.getToken());
        if (email == null) {
            throw new BadRequestException("Invalid or expired password reset token.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        sessionRepository.revokeAllByUserId(user.getUserId());
        passwordResetTokens.remove(request.getToken());

        return "Password reset successfully. Please log in again.";
    }
}
package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.UserManagement.config.JwtUtil;
import com.example.flowmerceproject.UserManagement.dto.PasswordDTOs;
import com.example.flowmerceproject.UserManagement.dto.RegisterRequest;
import com.example.flowmerceproject.UserManagement.entity.Role;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.entity.VerificationToken;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.UnauthorizedException;
import com.example.flowmerceproject.UserManagement.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Unit Tests")
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private MerchantRepository merchantRepository;
    @Mock private SessionRepository sessionRepository;
    @Mock private VerificationTokenRepository tokenRepository;
    @Mock private UserProfileRepository userProfileRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtUtil jwtUtil;
    @Mock private EmailService emailService;
    @Mock private SessionCacheService sessionCacheService;

    @InjectMocks
    private AuthService authService;

    private User activeUser;
    private User inactiveUser;

    @BeforeEach
    void setUp() {
        activeUser = User.builder()
                .userId(1)
                .email("merchant@test.com")
                .passwordHash("$2a$hashed")
                .fullName("Test Merchant")
                .role(Role.MERCHANT)
                .isActive(true)
                .build();

        inactiveUser = User.builder()
                .userId(2)
                .email("inactive@test.com")
                .passwordHash("$2a$hashed")
                .fullName("Inactive User")
                .role(Role.MERCHANT)
                .isActive(false)
                .build();
    }

    // ── U-AUTH-01: register — new user creates merchant profile + sends email ──

    @Test
    @DisplayName("U-AUTH-01: register - creates user, merchant profile, sends activation email")
    void register_newEmail_createsUserAndSendsActivationEmail() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("new@test.com");
        request.setPassword("SecureP@ss1");
        request.setFullName("New Merchant");

        when(userRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(passwordEncoder.encode("SecureP@ss1")).thenReturn("$2a$hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setUserId(10);
            return u;
        });

        String result = authService.register(request);

        assertThat(result).contains("activate");
        verify(merchantRepository).save(any());
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendActivationEmail(eq("new@test.com"), anyString());
    }

    // ── U-AUTH-02: register — duplicate email throws ConflictException ─────────

    @Test
    @DisplayName("U-AUTH-02: register - duplicate email throws ConflictException")
    void register_duplicateEmail_throwsConflictException() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("merchant@test.com");
        request.setPassword("pass");
        request.setFullName("Dupe");

        when(userRepository.existsByEmail("merchant@test.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already registered");
    }

    // ── U-AUTH-03: activateAccount — valid token activates user ───────────────

    @Test
    @DisplayName("U-AUTH-03: activateAccount - valid token activates user")
    void activateAccount_validToken_activatesUser() {
        VerificationToken token = VerificationToken.builder()
                .token("valid-token")
                .email("merchant@test.com")
                .type(VerificationToken.TokenType.ACTIVATION)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(false)
                .build();

        when(tokenRepository.findByTokenAndTypeAndUsedFalse(
                "valid-token", VerificationToken.TokenType.ACTIVATION))
                .thenReturn(Optional.of(token));
        when(userRepository.findByEmail("merchant@test.com")).thenReturn(Optional.of(inactiveUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tokenRepository.save(any())).thenReturn(token);

        String result = authService.activateAccount("valid-token");

        assertThat(result).contains("activated");
        assertThat(inactiveUser.getIsActive()).isTrue();
        assertThat(token.getUsed()).isTrue();
    }

    // ── U-AUTH-04: activateAccount — expired token throws BadRequestException ──

    @Test
    @DisplayName("U-AUTH-04: activateAccount - expired token throws BadRequestException")
    void activateAccount_expiredToken_throwsBadRequestException() {
        VerificationToken expiredToken = VerificationToken.builder()
                .token("expired-token")
                .email("merchant@test.com")
                .type(VerificationToken.TokenType.ACTIVATION)
                .expiresAt(LocalDateTime.now().minusHours(1))
                .used(false)
                .build();

        when(tokenRepository.findByTokenAndTypeAndUsedFalse(
                "expired-token", VerificationToken.TokenType.ACTIVATION))
                .thenReturn(Optional.of(expiredToken));

        assertThatThrownBy(() -> authService.activateAccount("expired-token"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("expired");
    }

    // ── U-AUTH-05: activateAccount — invalid token throws BadRequestException ──

    @Test
    @DisplayName("U-AUTH-05: activateAccount - invalid/unknown token throws BadRequestException")
    void activateAccount_invalidToken_throwsBadRequestException() {
        when(tokenRepository.findByTokenAndTypeAndUsedFalse(
                "bad-token", VerificationToken.TokenType.ACTIVATION))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.activateAccount("bad-token"))
                .isInstanceOf(BadRequestException.class);
    }

    // ── U-AUTH-06: forgotPassword — registered email creates reset token ───────

    @Test
    @DisplayName("U-AUTH-06: forgotPassword - registered email creates reset token and sends email")
    void forgotPassword_registeredEmail_createsResetTokenAndSendsEmail() {
        when(userRepository.findByEmail("merchant@test.com")).thenReturn(Optional.of(activeUser));

        authService.forgotPassword("merchant@test.com");

        verify(tokenRepository).deleteByEmailAndType(
                eq("merchant@test.com"), eq(VerificationToken.TokenType.PASSWORD_RESET));
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendPasswordResetEmail(eq("merchant@test.com"), anyString());
    }

    // ── U-AUTH-07: forgotPassword — unknown email is silently ignored ──────────

    @Test
    @DisplayName("U-AUTH-07: forgotPassword - unknown email returns silently (no enumeration)")
    void forgotPassword_unknownEmail_noExceptionNoEmail() {
        when(userRepository.findByEmail("nobody@test.com")).thenReturn(Optional.empty());

        authService.forgotPassword("nobody@test.com");

        verify(emailService, never()).sendPasswordResetEmail(any(), any());
        verify(tokenRepository, never()).save(any());
    }

    // ── U-AUTH-08: resetPassword — valid token updates password ───────────────

    @Test
    @DisplayName("U-AUTH-08: resetPassword - valid token updates password and marks token used")
    void resetPassword_validToken_updatesPasswordAndInvalidatesToken() {
        VerificationToken resetToken = VerificationToken.builder()
                .token("reset-token")
                .email("merchant@test.com")
                .type(VerificationToken.TokenType.PASSWORD_RESET)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(false)
                .build();

        PasswordDTOs.ResetPasswordRequest request = new PasswordDTOs.ResetPasswordRequest();
        request.setToken("reset-token");
        request.setNewPassword("NewP@ss123");
        request.setConfirmNewPassword("NewP@ss123");

        when(tokenRepository.findByTokenAndTypeAndUsedFalse(
                "reset-token", VerificationToken.TokenType.PASSWORD_RESET))
                .thenReturn(Optional.of(resetToken));
        when(userRepository.findByEmail("merchant@test.com")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.encode("NewP@ss123")).thenReturn("$2a$newhash");
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(tokenRepository.save(any())).thenReturn(resetToken);

        authService.resetPassword(request);

        assertThat(activeUser.getPasswordHash()).isEqualTo("$2a$newhash");
        assertThat(resetToken.getUsed()).isTrue();
    }
}

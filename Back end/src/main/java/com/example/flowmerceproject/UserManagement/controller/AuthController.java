package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.config.CookieUtil;
import com.example.flowmerceproject.UserManagement.dto.*;
import com.example.flowmerceproject.UserManagement.service.AuthService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import java.security.Principal;
import java.util.Objects;

@RestController
@RequestMapping("/auth/merchant")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CookieUtil cookieUtil;

    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<String>> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(authService.register(request), "Registration successful"));
    }

    @GetMapping("/activate")
    public ResponseEntity<ApiResponse<String>> activateAccount(@RequestParam String token) {
        return ResponseEntity.ok(ApiResponse.ok(authService.activateAccount(token)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        AuthResponse auth = authService.login(request);
        // SEC-6: also set httpOnly cookies so the browser doesn't need to manage tokens.
        // SEC-11: namespaced to the merchant scope so a customer login elsewhere in the
        // same browser can't overwrite this session's cookie.
        cookieUtil.setAuthCookies(response, CookieUtil.MERCHANT_SCOPE, auth.getAccessToken(), auth.getRefreshToken(),
                jwtExpirationMs / 1000, 30L * 24 * 3600);
        return ResponseEntity.ok(ApiResponse.ok(auth, "Login successful"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @Valid @RequestBody(required = false) RefreshTokenRequest bodyRequest,
            jakarta.servlet.http.HttpServletRequest request,
            HttpServletResponse response) {
        // SEC-6: accept refresh token from httpOnly cookie or request body.
        String token = CookieUtil.extractRefreshToken(request, CookieUtil.MERCHANT_SCOPE);
        if (token == null && bodyRequest != null) token = bodyRequest.getRefreshToken();
        if (token == null) throw new BadRequestException("Refresh token is required");
        AuthResponse auth = authService.refreshToken(token);
        cookieUtil.setAuthCookies(response, CookieUtil.MERCHANT_SCOPE, auth.getAccessToken(), auth.getRefreshToken(),
                jwtExpirationMs / 1000, 30L * 24 * 3600);
        return ResponseEntity.ok(ApiResponse.ok(auth));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            jakarta.servlet.http.HttpServletRequest request,
            HttpServletResponse response) {
        // Accept token from cookie or header.
        String token = CookieUtil.extractAccessToken(request, CookieUtil.MERCHANT_SCOPE);
        if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
        if (token == null) throw new BadRequestException("No active session found");
        cookieUtil.clearAuthCookies(response, CookieUtil.MERCHANT_SCOPE);
        return ResponseEntity.ok(ApiResponse.ok(authService.logout(token)));
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> me(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(authService.getCurrentUser(principal.getName())));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<String>> forgotPassword(
            @Valid @RequestBody PasswordDTOs.ForgotPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.forgotPassword(request.getEmail())));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @Valid @RequestBody PasswordDTOs.ResetPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.resetPassword(request)));
    }
}

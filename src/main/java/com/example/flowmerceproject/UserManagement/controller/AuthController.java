package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.dto.*;
import com.example.flowmerceproject.UserManagement.service.AuthService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request), "Login successful"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refreshToken(request.getRefreshToken())));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<String>> logout(
            @RequestHeader("Authorization") String authHeader) {
        Objects.requireNonNull(authHeader, "Authorization header is missing");
        if (!authHeader.startsWith("Bearer ")) {
            throw new BadRequestException("Invalid token format");
        }
        String token = authHeader.substring(7);
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

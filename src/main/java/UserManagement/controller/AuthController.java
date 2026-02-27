package UserManagement.controller;

import UserManagement.dto.LoginRequest;
import UserManagement.dto.PasswordDTOs;
import UserManagement.dto.RegisterRequest;
import UserManagement.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    // GET /api/auth/activate?token=xxx
    @GetMapping("/activate")
    public ResponseEntity<String> activateAccount(@RequestParam String token) {
        return ResponseEntity.ok(authService.activateAccount(token));
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<String> login(@Valid @RequestBody LoginRequest request) {
        String jwt = authService.login(request);
        return ResponseEntity.ok(jwt);
    }

    // POST /api/auth/logout  (requires Bearer token in header)
    @PostMapping("/logout")
    public ResponseEntity<String> logout(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7); // strip "Bearer "
        return ResponseEntity.ok(authService.logout(token));
    }

    // POST /api/auth/forgot-password
    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(
            @Valid @RequestBody PasswordDTOs.ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request.getEmail()));
    }

    // POST /api/auth/reset-password
    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(
            @Valid @RequestBody PasswordDTOs.ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }
}
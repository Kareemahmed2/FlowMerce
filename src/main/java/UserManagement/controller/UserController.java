package UserManagement.controller;

import UserManagement.dto.ChangePasswordRequest;
import UserManagement.dto.UpdateProfileRequest;
import UserManagement.dto.UserResponse;
import UserManagement.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // GET /api/users/me
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMyProfile(Principal principal) {
        return ResponseEntity.ok(userService.getMyProfile(principal.getName()));
    }

    // PUT /api/users/me
    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateProfile(
            Principal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(principal.getName(), request));
    }

    // PUT /api/users/me/change-password
    @PutMapping("/me/change-password")
    public ResponseEntity<String> changePassword(
            Principal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(userService.changePassword(principal.getName(), request));
    }

    // DELETE /api/users/me
    @DeleteMapping("/me")
    public ResponseEntity<String> deleteMyAccount(Principal principal) {
        return ResponseEntity.ok(userService.deleteMyAccount(principal.getName()));
    }

    // ── ADMIN ENDPOINTS ──────────────────────────

    // GET /api/admin/users
    @GetMapping("/api/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    // DELETE /api/admin/users/{userId}
    @DeleteMapping("/api/admin/users/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteUser(@PathVariable Integer userId) {
        return ResponseEntity.ok(userService.deleteUserById(userId));
    }
}
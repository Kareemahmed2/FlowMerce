package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.dto.MerchantDTOs;
import com.example.flowmerceproject.UserManagement.dto.UserResponse;
import com.example.flowmerceproject.UserManagement.service.MerchantService;
import com.example.flowmerceproject.UserManagement.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final MerchantService merchantService;
    private final UserService userService;

    // ── ADMIN ENDPOINTS ──────────────────────────

    // GET /api/admin/users
    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    // DELETE /api/admin/users/{userId}
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<String> deleteUser(@PathVariable Integer userId) {
        return ResponseEntity.ok(userService.deleteUserById(userId));
    }
    // ── ADMIN ENDPOINTS ──────────────────────────

    // GET /api/admin/merchants
    @GetMapping("/merchants")
    public ResponseEntity<List<MerchantDTOs.MerchantResponse>> getAllMerchants() {
        return ResponseEntity.ok(merchantService.getAllMerchants());
    }

    // PUT /api/admin/merchants/{merchantId}/verify
    @PutMapping("/merchants/{merchantId}/verify")
    public ResponseEntity<MerchantDTOs.MerchantResponse> verifyMerchant(
            @PathVariable Integer merchantId) {
        return ResponseEntity.ok(merchantService.verifyMerchant(merchantId));
    }

    // DELETE /api/admin/merchants/{merchantId}
    @DeleteMapping("/api/admin/merchants/{merchantId}")
    public ResponseEntity<Void> deleteMerchant(@PathVariable Integer merchantId) {
        merchantService.deleteMerchantById(merchantId);
        return ResponseEntity.noContent().build();
    }
}

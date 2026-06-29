package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.StoreMangement.dto.StoreDTOs;
import com.example.flowmerceproject.StoreMangement.service.StoreService;
import com.example.flowmerceproject.UserManagement.dto.MerchantDTOs;
import com.example.flowmerceproject.UserManagement.dto.UserResponse;
import com.example.flowmerceproject.UserManagement.service.MerchantService;
import com.example.flowmerceproject.UserManagement.service.UserService;
import com.example.flowmerceproject.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final MerchantService merchantService;
    private final UserService userService;
    private final StoreService storeService;

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<String>> deleteUser(@PathVariable Integer userId) {
        return ResponseEntity.ok(ApiResponse.ok(userService.deleteUserById(userId)));
    }

    @GetMapping("/merchants")
    public ResponseEntity<ApiResponse<List<MerchantDTOs.MerchantResponse>>> getAllMerchants() {
        return ResponseEntity.ok(ApiResponse.ok(merchantService.getAllMerchants()));
    }

    @PutMapping("/merchants/{merchantId}/verify")
    public ResponseEntity<ApiResponse<MerchantDTOs.MerchantResponse>> verifyMerchant(
            @PathVariable Integer merchantId) {
        return ResponseEntity.ok(ApiResponse.ok(merchantService.verifyMerchant(merchantId)));
    }

    @DeleteMapping("/merchants/{merchantId}")
    public ResponseEntity<ApiResponse<String>> deleteMerchant(@PathVariable Integer merchantId) {
        merchantService.deleteMerchantById(merchantId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Merchant deleted successfully."));
    }

    @PutMapping("/users/{userId}/activate")
    public ResponseEntity<ApiResponse<UserResponse>> activateUser(@PathVariable Integer userId) {
        return ResponseEntity.ok(ApiResponse.ok(userService.activateUser(userId)));
    }

    @GetMapping("/stores")
    public ResponseEntity<ApiResponse<List<StoreDTOs.StoreResponse>>> getAllStores() {
        return ResponseEntity.ok(ApiResponse.ok(storeService.getAllStores()));
    }
}

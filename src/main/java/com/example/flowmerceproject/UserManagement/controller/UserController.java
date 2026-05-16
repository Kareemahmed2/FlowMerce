package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.dto.ChangePasswordRequest;
import com.example.flowmerceproject.UserManagement.dto.UpdateProfileRequest;
import com.example.flowmerceproject.UserManagement.dto.UserResponse;
import com.example.flowmerceproject.UserManagement.service.UserService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getMyProfile(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getMyProfile(principal.getName())));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            Principal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.updateProfile(principal.getName(), request)));
    }

    @PutMapping("/me/change-password")
    public ResponseEntity<ApiResponse<String>> changePassword(
            Principal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                userService.changePassword(principal.getName(), request)));
    }

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<String>> deleteMyAccount(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(userService.deleteMyAccount(principal.getName())));
    }
}

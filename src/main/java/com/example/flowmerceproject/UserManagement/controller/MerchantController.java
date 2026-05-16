package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.dto.MerchantDTOs;
import com.example.flowmerceproject.UserManagement.service.MerchantService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/merchants")
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantService merchantService;

    @PostMapping("/me")
    public ResponseEntity<ApiResponse<MerchantDTOs.MerchantResponse>> createProfile(
            Principal principal,
            @Valid @RequestBody MerchantDTOs.MerchantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        merchantService.createMerchantProfile(principal.getName(), request),
                        "Merchant profile created"));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<MerchantDTOs.MerchantResponse>> getMyProfile(
            Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(
                merchantService.getMerchantProfile(principal.getName())));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMyAccount(Principal principal) {
        merchantService.deleteMerchantAccount(principal.getName());
        return ResponseEntity.noContent().build();
    }
}

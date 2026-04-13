package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.dto.MerchantDTOs;
import com.example.flowmerceproject.UserManagement.service.MerchantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/merchants")
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantService merchantService;

    // POST /api/merchants/me  — any logged-in user can become a merchant
    @PostMapping("/me")
    public ResponseEntity<MerchantDTOs.MerchantResponse> createProfile(
            Principal principal,
            @Valid @RequestBody MerchantDTOs.MerchantRequest request) {
        return ResponseEntity.ok(merchantService.createMerchantProfile(principal.getName(), request));
    }

    // GET /api/merchants/me
    @GetMapping("/me")
    public ResponseEntity<MerchantDTOs.MerchantResponse> getMyProfile(Principal principal) {
        return ResponseEntity.ok(merchantService.getMerchantProfile(principal.getName()));
    }

    // DELETE /api/merchants/me
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMyAccount(Principal principal) {
        merchantService.deleteMerchantAccount(principal.getName());
        return ResponseEntity.noContent().build();
    }


}
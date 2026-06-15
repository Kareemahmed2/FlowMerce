package com.example.flowmerceproject.PaymentManagement.controller;

import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.service.WalletService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/wallets")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    // GET /wallets/me — buyer's wallet
    @GetMapping("/me")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<PaymentDTOs.WalletResponse>> getMyWallet(
            Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(
                walletService.getCustomerWallet(principal.getName())));
    }

    // POST /wallets/me/topup — simulation top-up
    @PostMapping("/me/topup")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<PaymentDTOs.WalletResponse>> topUp(
            Principal principal,
            @Valid @RequestBody PaymentDTOs.TopUpRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                walletService.topUp(principal.getName(), request.getAmount()),
                "Wallet topped up by " + request.getAmount() + " EGP"));
    }

    // GET /wallets/me/transactions — buyer's transaction history
    @GetMapping("/me/transactions")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<List<PaymentDTOs.WalletTransactionResponse>>> getMyTransactions(
            Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(
                walletService.getCustomerTransactions(principal.getName())));
    }

    // GET /wallets/store/{storeId} — merchant's store wallet
    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<PaymentDTOs.WalletResponse>> getStoreWallet(
            Principal principal,
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                walletService.getMerchantWallet(principal.getName(), storeId)));
    }

    // GET /wallets/store/{storeId}/transactions — merchant's transaction history
    @GetMapping("/store/{storeId}/transactions")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<PaymentDTOs.WalletTransactionResponse>>> getStoreTransactions(
            Principal principal,
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                walletService.getMerchantTransactions(principal.getName(), storeId)));
    }
}

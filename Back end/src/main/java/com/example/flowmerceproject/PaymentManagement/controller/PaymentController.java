package com.example.flowmerceproject.PaymentManagement.controller;

import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.service.PaymentServiceImpl;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentServiceImpl paymentService;

    // POST /payments/initiate — buyer initiates a payment for an existing order
    @PostMapping("/initiate")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<PaymentDTOs.PaymentResponse>> initiatePayment(
            Principal principal,
            @Valid @RequestBody PaymentDTOs.InitiatePaymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        paymentService.initiatePayment(request, principal.getName()),
                        "Payment initiated"));
    }

    // GET /payments/{paymentId}
    @GetMapping("/{paymentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PaymentDTOs.PaymentResponse>> getPayment(
            Principal principal,
            @PathVariable Integer paymentId) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.getPayment(paymentId, principal.getName())));
    }

    // GET /payments/order/{orderId}
    @GetMapping("/order/{orderId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PaymentDTOs.PaymentResponse>> getPaymentByOrder(
            Principal principal,
            @PathVariable Integer orderId) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.getPaymentByOrder(orderId, principal.getName())));
    }

    // POST /payments/{paymentId}/confirm — merchant confirms COD or bank transfer
    @PostMapping("/{paymentId}/confirm")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<PaymentDTOs.PaymentResponse>> confirmPayment(
            Principal principal,
            @PathVariable Integer paymentId,
            @RequestBody(required = false) PaymentDTOs.ConfirmPaymentRequest request) {
        if (request == null) request = new PaymentDTOs.ConfirmPaymentRequest();
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.confirmPayment(paymentId, request, principal.getName()),
                "Payment confirmed"));
    }

    // GET /payments/store/{storeId} — INT-18: list payments for a store (merchant)
    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<PaymentDTOs.PaymentResponse>>> getStorePayments(
            Principal principal,
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.getStorePayments(storeId, principal.getName())));
    }

    // POST /payments/{paymentId}/refund — merchant issues a refund
    @PostMapping("/{paymentId}/refund")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<PaymentDTOs.PaymentResponse>> refundPayment(
            Principal principal,
            @PathVariable Integer paymentId,
            @Valid @RequestBody PaymentDTOs.RefundRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                paymentService.refundPayment(paymentId, request, principal.getName()),
                "Refund processed"));
    }
}

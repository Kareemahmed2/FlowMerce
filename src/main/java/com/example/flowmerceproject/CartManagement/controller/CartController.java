package com.example.flowmerceproject.CartManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.service.CartService;
import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;
    private final CheckoutService checkoutService;

    @GetMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<CartDTOs.CartResponse>> getCart(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(cartService.getMyCart(principal.getName())));
    }

    @PostMapping("/items")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<CartDTOs.CartResponse>> addItem(
            Principal principal,
            @Valid @RequestBody CartDTOs.AddToCartRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                cartService.addItem(principal.getName(), request)));
    }

    @PutMapping("/items/{cartItemId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<CartDTOs.CartResponse>> updateQuantity(
            Principal principal,
            @PathVariable Integer cartItemId,
            @Valid @RequestBody CartDTOs.UpdateQuantityRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                cartService.updateItemQuantity(principal.getName(), cartItemId, request)));
    }

    @DeleteMapping("/items/{cartItemId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<CartDTOs.CartResponse>> removeItem(
            Principal principal,
            @PathVariable Integer cartItemId) {
        return ResponseEntity.ok(ApiResponse.ok(
                cartService.removeItem(principal.getName(), cartItemId)));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<String>> clearCart(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(
                cartService.clearCart(principal.getName())));
    }

    @PostMapping("/checkout")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<CheckoutService.CheckoutSummary>> checkout(
            Principal principal,
            @Valid @RequestBody CartDTOs.CheckoutRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                checkoutService.processCheckout(principal.getName(), request),
                "Checkout processed — please complete payment"));
    }
}

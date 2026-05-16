package com.example.flowmerceproject.CartManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.service.CartService;
import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;
    private final CheckoutService checkoutService;

    // GET /api/cart — get my cart
    @GetMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<CartDTOs.CartResponse> getCart(Principal principal) {
        return ResponseEntity.ok(cartService.getMyCart(principal.getName()));
    }

    // POST /api/cart/items — add item to cart
    @PostMapping("/items")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<CartDTOs.CartResponse> addItem(
            Principal principal,
            @Valid @RequestBody CartDTOs.AddToCartRequest request) {
        return ResponseEntity.ok(cartService.addItem(principal.getName(), request));
    }

    // PUT /api/cart/items/{cartItemId} — update item quantity
    @PutMapping("/items/{cartItemId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<CartDTOs.CartResponse> updateQuantity(
            Principal principal,
            @PathVariable Integer cartItemId,
            @Valid @RequestBody CartDTOs.UpdateQuantityRequest request) {
        return ResponseEntity.ok(
                cartService.updateItemQuantity(principal.getName(), cartItemId, request));
    }

    // DELETE /api/cart/items/{cartItemId} — remove item
    @DeleteMapping("/items/{cartItemId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<CartDTOs.CartResponse> removeItem(
            Principal principal,
            @PathVariable Integer cartItemId) {
        return ResponseEntity.ok(cartService.removeItem(principal.getName(), cartItemId));
    }

    // DELETE /api/cart — clear entire cart
    @DeleteMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<String> clearCart(Principal principal) {
        return ResponseEntity.ok(cartService.clearCart(principal.getName()));
    }

    // POST /api/cart/checkout — proceed to checkout
    @PostMapping("/checkout")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<CheckoutService.CheckoutSummary> checkout(
            Principal principal,
            @Valid @RequestBody CartDTOs.CheckoutRequest request) {
        return ResponseEntity.ok(
                checkoutService.processCheckout(principal.getName(), request));
    }
}
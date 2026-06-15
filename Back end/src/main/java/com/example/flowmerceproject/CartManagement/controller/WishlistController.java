package com.example.flowmerceproject.CartManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.dto.WishlistDTOs;
import com.example.flowmerceproject.CartManagement.service.WishlistService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @GetMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<WishlistDTOs.WishlistResponse>> getWishlist(
            Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(
                wishlistService.getMyWishlist(principal.getName())));
    }

    @PostMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<WishlistDTOs.WishlistResponse>> addItem(
            Principal principal,
            @Valid @RequestBody WishlistDTOs.AddToWishlistRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                wishlistService.addToWishlist(principal.getName(), request)));
    }

    @DeleteMapping("/{productId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<WishlistDTOs.WishlistResponse>> removeItem(
            Principal principal,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(ApiResponse.ok(
                wishlistService.removeFromWishlist(principal.getName(), productId)));
    }

    @PostMapping("/{productId}/move-to-cart")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<CartDTOs.CartResponse>> moveToCart(
            Principal principal,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(ApiResponse.ok(
                wishlistService.moveToCart(principal.getName(), productId)));
    }
}

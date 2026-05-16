package com.example.flowmerceproject.CartManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.dto.WishlistDTOs;
import com.example.flowmerceproject.CartManagement.service.WishlistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    // GET /api/wishlist
    @GetMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<WishlistDTOs.WishlistResponse> getWishlist(Principal principal) {
        return ResponseEntity.ok(wishlistService.getMyWishlist(principal.getName()));
    }

    // POST /api/wishlist
    //add product to wishlist
    @PostMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<WishlistDTOs.WishlistResponse> addItem(
            Principal principal,
            @Valid @RequestBody WishlistDTOs.AddToWishlistRequest request) {
        return ResponseEntity.ok(
                wishlistService.addToWishlist(principal.getName(), request));
    }

    // DELETE /api/wishlist/{productId}
    //delete product from wishlist
    @DeleteMapping("/{productId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<WishlistDTOs.WishlistResponse> removeItem(
            Principal principal,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(
                wishlistService.removeFromWishlist(principal.getName(), productId));
    }

    // POST /api/wishlist/{productId}/move-to-cart
    @PostMapping("/{productId}/move-to-cart")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<CartDTOs.CartResponse> moveToCart(
            Principal principal,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(
                wishlistService.moveToCart(principal.getName(), productId));
    }
}
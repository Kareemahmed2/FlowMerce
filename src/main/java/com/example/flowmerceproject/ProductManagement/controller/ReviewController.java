package com.example.flowmerceproject.ProductManagement.controller;

import com.example.flowmerceproject.ProductManagement.dto.ReviewDTOs;
import com.example.flowmerceproject.ProductManagement.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/products/{productId}/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping
    public ResponseEntity<List<ReviewDTOs.ReviewResponse>> getAll(
            @PathVariable Integer productId) {
        return ResponseEntity.ok(reviewService.getProductReviews(productId));
    }

    @PostMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ReviewDTOs.ReviewResponse> submit(
            Principal principal,
            @PathVariable Integer productId,
            @Valid @RequestBody ReviewDTOs.CreateReviewRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviewService.submitReview(principal.getName(), productId, request));
    }

    @PutMapping
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ReviewDTOs.ReviewResponse> edit(
            Principal principal,
            @PathVariable Integer productId,
            @Valid @RequestBody ReviewDTOs.UpdateReviewRequest request) {
        return ResponseEntity.ok(
                reviewService.editReview(principal.getName(), productId, request));
    }

    @DeleteMapping("/{reviewId}")
    @PreAuthorize("hasRole('BUYER') or hasRole('ADMIN')")
    public ResponseEntity<String> delete(
            Principal principal, @PathVariable Integer reviewId) {
        return ResponseEntity.ok(
                reviewService.deleteReview(principal.getName(), reviewId));
    }
}
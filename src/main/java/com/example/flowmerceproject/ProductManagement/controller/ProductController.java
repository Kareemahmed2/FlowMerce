package com.example.flowmerceproject.ProductManagement.controller;

import com.example.flowmerceproject.ProductManagement.dto.ProductDTOs;
import com.example.flowmerceproject.ProductManagement.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/stores/{storeId}/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @PostMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ProductDTOs.ProductResponse> create(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody ProductDTOs.CreateProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(productService.createProduct(principal.getName(), storeId, request));
    }

    @GetMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<List<ProductDTOs.ProductResponse>> getAll(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(
                productService.getStoreProducts(principal.getName(), storeId));
    }

    @GetMapping("/public")
    public ResponseEntity<List<ProductDTOs.ProductResponse>> getActive(
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(productService.getActiveProducts(storeId));
    }

    @GetMapping("/{productId}")
    public ResponseEntity<ProductDTOs.ProductResponse> getById(
            @PathVariable Integer storeId,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(productService.getProductById(productId));
    }

    @PutMapping("/{productId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ProductDTOs.ProductResponse> update(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId,
            @RequestBody ProductDTOs.UpdateProductRequest request) {
        return ResponseEntity.ok(
                productService.updateProduct(principal.getName(), storeId, productId, request));
    }

    @PutMapping("/{productId}/toggle")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ProductDTOs.ProductResponse> toggle(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(
                productService.toggleActive(principal.getName(), storeId, productId));
    }

    @DeleteMapping("/{productId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<String> delete(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(
                productService.deleteProduct(principal.getName(), storeId, productId));
    }

    @GetMapping("/search")
    public ResponseEntity<List<ProductDTOs.ProductResponse>> search(
            @RequestParam String keyword) {
        return ResponseEntity.ok(productService.searchProducts(keyword));
    }

    @PostMapping("/{productId}/media")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ProductDTOs.MediaResponse> addMedia(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId,
            @Valid @RequestBody ProductDTOs.AddMediaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(productService.addMedia(
                        principal.getName(), storeId, productId, request));
    }

    @DeleteMapping("/{productId}/media/{mediaId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<String> deleteMedia(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer mediaId) {
        return ResponseEntity.ok(
                productService.deleteMedia(principal.getName(), storeId, mediaId));
    }
}
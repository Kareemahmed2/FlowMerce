package com.example.flowmerceproject.ProductManagement.controller;

import com.example.flowmerceproject.ProductManagement.dto.ProductDTOs;
import com.example.flowmerceproject.ProductManagement.service.ProductService;
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
@RequestMapping("/stores/{storeId}/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @PostMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ProductDTOs.ProductResponse>> create(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody ProductDTOs.CreateProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        productService.createProduct(principal.getName(), storeId, request),
                        "Product created"));
    }

    @GetMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<ProductDTOs.ProductResponse>>> getAll(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                productService.getStoreProducts(principal.getName(), storeId)));
    }

    @GetMapping("/public")
    public ResponseEntity<ApiResponse<List<ProductDTOs.ProductResponse>>> getActive(
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(productService.getActiveProducts(storeId)));
    }

    @GetMapping("/{productId}")
    public ResponseEntity<ApiResponse<ProductDTOs.ProductResponse>> getById(
            @PathVariable Integer storeId,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(ApiResponse.ok(productService.getProductById(productId)));
    }

    @PutMapping("/{productId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ProductDTOs.ProductResponse>> update(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId,
            @RequestBody ProductDTOs.UpdateProductRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                productService.updateProduct(
                        principal.getName(), storeId, productId, request)));
    }

    @PutMapping("/{productId}/toggle")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ProductDTOs.ProductResponse>> toggle(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(ApiResponse.ok(
                productService.toggleActive(principal.getName(), storeId, productId)));
    }

    @DeleteMapping("/{productId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> delete(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId) {
        return ResponseEntity.ok(ApiResponse.ok(
                productService.deleteProduct(principal.getName(), storeId, productId)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<ProductDTOs.ProductResponse>>> search(
            @RequestParam String keyword) {
        return ResponseEntity.ok(ApiResponse.ok(productService.searchProducts(keyword)));
    }

    @PostMapping("/{productId}/media")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ProductDTOs.MediaResponse>> addMedia(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId,
            @Valid @RequestBody ProductDTOs.AddMediaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        productService.addMedia(
                                principal.getName(), storeId, productId, request),
                        "Media added"));
    }

    @DeleteMapping("/{productId}/media/{mediaId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> deleteMedia(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer mediaId) {
        return ResponseEntity.ok(ApiResponse.ok(
                productService.deleteMedia(principal.getName(), storeId, mediaId)));
    }
}

package com.example.flowmerceproject.ProductManagement.controller;

import com.example.flowmerceproject.ProductManagement.dto.CategoryDTOs;
import com.example.flowmerceproject.ProductManagement.service.CategoryService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Store-scoped category management.
 *
 * GET    /stores/{storeId}/categories              → list (global + store-owned)
 * POST   /stores/{storeId}/categories              → create store-owned category
 * DELETE /stores/{storeId}/categories/{categoryId} → delete store-owned category
 */
@RestController
@RequestMapping("/stores/{storeId}/categories")
@RequiredArgsConstructor
public class StoreCategoryController {

    private final CategoryService categoryService;

    @GetMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<CategoryDTOs.CategoryResponse>>> getAll(
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                categoryService.getStoreCombinedCategories(storeId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<CategoryDTOs.CategoryResponse>> create(
            @PathVariable Integer storeId,
            @Valid @RequestBody CategoryDTOs.CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        categoryService.createStoreCategory(storeId, request),
                        "Category created"));
    }

    @DeleteMapping("/{categoryId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> delete(
            @PathVariable Integer storeId,
            @PathVariable Integer categoryId) {
        categoryService.deleteStoreCategory(storeId, categoryId);
        return ResponseEntity.ok(ApiResponse.ok("Category deleted"));
    }
}

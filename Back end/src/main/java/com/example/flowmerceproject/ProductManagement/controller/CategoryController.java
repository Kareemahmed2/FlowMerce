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

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryDTOs.CategoryResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(categoryService.getAllCategories()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryDTOs.CategoryResponse>> getById(
            @PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(categoryService.getCategoryById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CategoryDTOs.CategoryResponse>> create(
            @Valid @RequestBody CategoryDTOs.CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(categoryService.createCategory(request),
                        "Category created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CategoryDTOs.CategoryResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody CategoryDTOs.CategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                categoryService.updateCategory(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> delete(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(categoryService.deleteCategory(id)));
    }
}

package com.example.flowmerceproject.ProductManagement.service;

import com.example.flowmerceproject.ProductManagement.dto.CategoryDTOs;
import com.example.flowmerceproject.ProductManagement.entity.Category;
import com.example.flowmerceproject.ProductManagement.repository.CategoryRepository;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;

    @Transactional
    public CategoryDTOs.CategoryResponse createCategory(CategoryDTOs.CategoryRequest request) {
        boolean nameExists = request.getStoreId() != null
                ? categoryRepository.existsByNameAndStore_StoreId(request.getName(), request.getStoreId())
                : categoryRepository.existsByName(request.getName());
        if (nameExists) {
            throw new ConflictException("Category already exists: " + request.getName());
        }
        Category category = Category.builder()
                .name(request.getName())
                .description(request.getDescription())
                .build();
        categoryRepository.save(category);
        return toResponse(category);
    }

    public List<CategoryDTOs.CategoryResponse> getAllCategories() {
        return categoryRepository.findAll()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public CategoryDTOs.CategoryResponse getCategoryById(Integer id) {
        return toResponse(categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id)));
    }

    @Transactional
    public CategoryDTOs.CategoryResponse updateCategory(Integer id,
                                                        CategoryDTOs.CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
        category.setName(request.getName());
        if (request.getDescription() != null) category.setDescription(request.getDescription());
        categoryRepository.save(category);
        return toResponse(category);
    }

    @Transactional
    public String deleteCategory(Integer id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
        categoryRepository.delete(category);
        return "Category deleted successfully.";
    }

    // ── STORE-SPECIFIC CATEGORY MANAGEMENT ───────────────────────────────────

    /** Returns global categories + this store's own categories, store-specific first. */
    public List<CategoryDTOs.CategoryResponse> getStoreCombinedCategories(Integer storeId) {
        List<Category> storeOwned = categoryRepository.findByStore_StoreId(storeId);
        List<Category> globals    = categoryRepository.findByStoreIsNull();

        List<CategoryDTOs.CategoryResponse> result = new ArrayList<>();
        Set<String> addedNames = new HashSet<>();

        for (Category c : storeOwned) {
            result.add(toResponse(c));
            addedNames.add(c.getName().toLowerCase());
        }
        for (Category c : globals) {
            if (!addedNames.contains(c.getName().toLowerCase())) {
                result.add(toResponse(c));
            }
        }
        return result;
    }

    /** Creates a category owned by a specific store (merchant-callable). */
    @Transactional
    public CategoryDTOs.CategoryResponse createStoreCategory(Integer storeId,
                                                              CategoryDTOs.CategoryRequest request) {
        if (categoryRepository.existsByNameAndStore_StoreId(request.getName(), storeId)) {
            throw new ConflictException("Category '" + request.getName() + "' already exists in your store.");
        }
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));
        Category category = Category.builder()
                .name(request.getName())
                .description(request.getDescription())
                .store(store)
                .build();
        categoryRepository.save(category);
        return toResponse(category);
    }

    /** Deletes a store-owned category (merchant can only delete their own). */
    @Transactional
    public void deleteStoreCategory(Integer storeId, Integer categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + categoryId));
        if (category.getStore() == null || !category.getStore().getStoreId().equals(storeId)) {
            throw new ConflictException("Cannot delete a global category.");
        }
        categoryRepository.delete(category);
    }

    public CategoryDTOs.CategoryResponse toResponse(Category c) {
        return CategoryDTOs.CategoryResponse.builder()
                .categoryId(c.getCategoryId())
                .storeId(c.getStore() != null ? c.getStore().getStoreId() : null)
                .name(c.getName())
                .description(c.getDescription())
                .build();
    }
}

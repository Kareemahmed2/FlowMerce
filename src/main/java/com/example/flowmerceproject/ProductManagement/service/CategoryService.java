package com.example.flowmerceproject.ProductManagement.service;

import com.example.flowmerceproject.ProductManagement.dto.CategoryDTOs;
import com.example.flowmerceproject.ProductManagement.entity.Category;
import com.example.flowmerceproject.ProductManagement.repository.CategoryRepository;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    @Transactional
    public CategoryDTOs.CategoryResponse createCategory(CategoryDTOs.CategoryRequest request) {
        if (categoryRepository.existsByName(request.getName())) {
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

    public CategoryDTOs.CategoryResponse toResponse(Category c) {
        return CategoryDTOs.CategoryResponse.builder()
                .categoryId(c.getCategoryId())
                .storeId(c.getStore() != null ? c.getStore().getStoreId() : null)
                .name(c.getName())
                .description(c.getDescription())
                .build();
    }
}

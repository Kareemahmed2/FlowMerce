package com.example.flowmerceproject.ProductManagement.repository;

import com.example.flowmerceproject.ProductManagement.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Integer> {

    List<Product> findByStore_StoreId(Integer storeId);

    List<Product> findByStore_StoreIdAndIsActive(Integer storeId, Boolean isActive);

    List<Product> findByStore_StoreIdAndCategory_CategoryId(Integer storeId, Integer categoryId);

    Optional<Product> findByProductIdAndStore_StoreId(Integer productId, Integer storeId);

    List<Product> findByCategory_CategoryId(Integer categoryId);

    List<Product> findByNameContainingIgnoreCase(String keyword);
}

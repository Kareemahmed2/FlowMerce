package com.example.flowmerceproject.ProductManagement.repository;

import com.example.flowmerceproject.ProductManagement.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Integer> {

    List<Product> findByStore_StoreId(Integer storeId);

    List<Product> findByStore_StoreIdAndIsActive(Integer storeId, Boolean isActive);

    List<Product> findByCategory_CategoryId(Integer categoryId);

    List<Product> findByNameContainingIgnoreCase(String keyword);

    List<Product> findByStore_StoreIdAndNameContainingIgnoreCase(
            Integer storeId, String keyword);

    // For inventory integration, I retrieve the store from the product.
    @Query("SELECT p FROM Product p WHERE p.productId = :productId")
    Product findProductWithStore(@Param("productId") Integer productId);
}
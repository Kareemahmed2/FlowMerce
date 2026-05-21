package com.example.flowmerceproject.StoreMangement.repository;

import com.example.flowmerceproject.StoreMangement.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByStore_StoreId(Integer storeId);
    List<Product> findByStore_StoreIdAndCategory_CategoryId(Integer storeId, Integer categoryId);
    Optional<Product> findByProductIdAndStore_StoreId(Long productId, Integer storeId);
}

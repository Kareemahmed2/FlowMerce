package com.example.flowmerceproject.ProductManagement.repository;

import com.example.flowmerceproject.ProductManagement.entity.ProductMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductMediaRepository extends JpaRepository<ProductMedia, Integer> {
    List<ProductMedia> findByProduct_ProductId(Integer productId);
}
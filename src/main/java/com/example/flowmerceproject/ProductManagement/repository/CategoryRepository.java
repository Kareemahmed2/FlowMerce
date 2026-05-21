package com.example.flowmerceproject.ProductManagement.repository;

import com.example.flowmerceproject.ProductManagement.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {

    Optional<Category> findByName(String name);
    boolean existsByName(String name);

    List<Category> findByStore_StoreId(Integer storeId);
    List<Category> findByStoreIsNull();
}

package com.example.flowmerceproject.StoreMangement.repository;

import com.example.flowmerceproject.StoreMangement.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {
    List<Category> findByStore_StoreId(Integer storeId);
}

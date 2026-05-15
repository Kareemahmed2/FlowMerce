package com.example.flowmerceproject.InventoryManagement.repository;

import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByProductId(Long productId);

    // Products at or below low stock threshold
    List<Inventory> findByQuantityLessThanEqual(Integer threshold);

    // Out of stock products
    List<Inventory> findByQuantity(Integer quantity);
}
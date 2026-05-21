package com.example.flowmerceproject.InventoryManagement.repository;

import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByProductId(Integer productId);

    List<Inventory> findByStoreId(Integer storeId);

    List<Inventory> findByQuantityLessThanEqual(Integer threshold);

    List<Inventory> findByQuantity(Integer quantity);
}

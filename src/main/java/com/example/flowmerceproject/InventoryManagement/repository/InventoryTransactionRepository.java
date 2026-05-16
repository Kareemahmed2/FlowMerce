package com.example.flowmerceproject.InventoryManagement.repository;

import com.example.flowmerceproject.InventoryManagement.entity.InventoryTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {

    List<InventoryTransaction> findByProductIdOrderByCreatedAtDesc(Long productId);

    List<InventoryTransaction> findByStoreIdOrderByCreatedAtDesc(Integer storeId);
}

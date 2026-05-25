package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShoppingCartRepository extends JpaRepository<ShoppingCart, Integer> {

    Optional<ShoppingCart> findByCustomer_CustomerIdAndStore_StoreId(Integer customerId, Integer storeId);

    boolean existsByCustomer_CustomerIdAndStore_StoreId(Integer customerId, Integer storeId);

    List<ShoppingCart> findByExpiresAtBefore(LocalDateTime now);
}

package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShoppingCartRepository extends JpaRepository<ShoppingCart, Integer> {

    @Query("SELECT c FROM ShoppingCart c LEFT JOIN FETCH c.items i LEFT JOIN FETCH i.product WHERE c.customer.customerId = :customerId AND c.store.storeId = :storeId")
    Optional<ShoppingCart> findByCustomer_CustomerIdAndStore_StoreId(@Param("customerId") Integer customerId, @Param("storeId") Integer storeId);

    @Query("SELECT c FROM ShoppingCart c LEFT JOIN FETCH c.items i LEFT JOIN FETCH i.product WHERE c.cartId = :cartId")
    Optional<ShoppingCart> findWithItemsById(@Param("cartId") Integer cartId);

    boolean existsByCustomer_CustomerIdAndStore_StoreId(Integer customerId, Integer storeId);

    List<ShoppingCart> findByExpiresAtBefore(LocalDateTime now);
}

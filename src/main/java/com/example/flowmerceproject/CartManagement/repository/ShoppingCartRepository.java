package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShoppingCartRepository extends JpaRepository<ShoppingCart, Integer> {

    Optional<ShoppingCart> findByCustomer_CustomerId(Integer customerId);

    boolean existsByCustomer_CustomerId(Integer customerId);

    List<ShoppingCart> findByExpiresAtBefore(LocalDateTime now);
}

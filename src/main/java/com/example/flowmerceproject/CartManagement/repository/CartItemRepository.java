package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Integer> {

    List<CartItem> findByCart_CartId(Integer cartId);

    // Check if this product already exists in the cart
    Optional<CartItem> findByCart_CartIdAndProduct_ProductId(
            Integer cartId, Integer productId);

    boolean existsByCart_CartIdAndProduct_ProductId(
            Integer cartId, Integer productId);
}
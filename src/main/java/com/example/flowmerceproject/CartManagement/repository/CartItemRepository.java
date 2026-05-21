package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Integer> {

    List<CartItem> findByCart_CartId(Integer cartId);

    Optional<CartItem> findByCart_CartIdAndProduct_ProductId(Integer cartId, Integer productId);

    boolean existsByCart_CartIdAndProduct_ProductId(Integer cartId, Integer productId);
}

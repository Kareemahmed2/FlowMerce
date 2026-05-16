package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WishlistRepository extends JpaRepository<Wishlist, Integer> {

    List<Wishlist> findByUser_UserId(Integer userId);

    Optional<Wishlist> findByUser_UserIdAndProduct_ProductId(
            Integer userId, Integer productId);

    boolean existsByUser_UserIdAndProduct_ProductId(
            Integer userId, Integer productId);

    void deleteByUser_UserIdAndProduct_ProductId(
            Integer userId, Integer productId);
}
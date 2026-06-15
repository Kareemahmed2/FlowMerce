package com.example.flowmerceproject.CartManagement.repository;

import com.example.flowmerceproject.CartManagement.entity.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WishlistRepository extends JpaRepository<Wishlist, Integer> {

    List<Wishlist> findByCustomer_CustomerId(Integer customerId);

    Optional<Wishlist> findByCustomer_CustomerIdAndProduct_ProductId(Integer customerId, Integer productId);

    boolean existsByCustomer_CustomerIdAndProduct_ProductId(Integer customerId, Integer productId);

    void deleteByCustomer_CustomerIdAndProduct_ProductId(Integer customerId, Integer productId);
}

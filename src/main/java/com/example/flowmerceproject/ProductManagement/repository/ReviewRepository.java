package com.example.flowmerceproject.ProductManagement.repository;

import com.example.flowmerceproject.ProductManagement.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Integer> {

    List<Review> findByProduct_ProductId(Integer productId);

    boolean existsByProduct_ProductIdAndCustomer_CustomerId(
            Integer productId, Integer customerId);

    Optional<Review> findByProduct_ProductIdAndCustomer_CustomerId(
            Integer productId, Integer customerId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.product.productId = :productId")
    Double calculateAverageRating(@Param("productId") Integer productId);
}
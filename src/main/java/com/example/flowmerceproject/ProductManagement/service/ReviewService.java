package com.example.flowmerceproject.ProductManagement.service;

import com.example.flowmerceproject.ProductManagement.dto.ReviewDTOs;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.entity.Review;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.ProductManagement.repository.ReviewRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;

    @Transactional
    public ReviewDTOs.ReviewResponse submitReview(String email, Integer productId,
                                                  ReviewDTOs.CreateReviewRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Customer customer = customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can submit reviews."));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + productId));

        if (reviewRepository.existsByProduct_ProductIdAndCustomer_CustomerId(
                productId, customer.getCustomerId())) {
            throw new ConflictException("You already reviewed this product.");
        }

        Review review = Review.builder()
                .product(product)
                .customer(customer)
                .rating(request.getRating())
                .title(request.getTitle())
                .comment(request.getComment())
                .build();

        reviewRepository.save(review);
        updateProductRating(product);
        return toResponse(review);
    }

    @Transactional
    public ReviewDTOs.ReviewResponse editReview(String email, Integer productId,
                                                ReviewDTOs.UpdateReviewRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Customer customer = customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can edit reviews."));

        Review review = reviewRepository
                .findByProduct_ProductIdAndCustomer_CustomerId(
                        productId, customer.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Review not found for this product."));

        if (request.getRating() != null) review.setRating(request.getRating());
        if (request.getTitle() != null)  review.setTitle(request.getTitle());
        if (request.getComment() != null) review.setComment(request.getComment());

        reviewRepository.save(review);
        updateProductRating(review.getProduct());
        return toResponse(review);
    }

    @Transactional
    public String deleteReview(String email, Integer reviewId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Customer customer = customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can delete reviews."));

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Review not found: " + reviewId));

        if (!review.getCustomer().getCustomerId().equals(customer.getCustomerId())) {
            throw new ForbiddenException("You can only delete your own reviews.");
        }

        Product product = review.getProduct();
        reviewRepository.delete(review);
        updateProductRating(product);
        return "Review deleted successfully.";
    }

    @Transactional(readOnly = true)
    public List<ReviewDTOs.ReviewResponse> getProductReviews(Integer productId) {
        productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + productId));
        return reviewRepository.findByProduct_ProductId(productId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private void updateProductRating(Product product) {
        Double avg = reviewRepository.calculateAverageRating(product.getProductId());
        product.setRating(avg != null ? Math.round(avg * 10.0) / 10.0 : 0.0);
        productRepository.save(product);
    }

    private ReviewDTOs.ReviewResponse toResponse(Review r) {
        return ReviewDTOs.ReviewResponse.builder()
                .reviewId(r.getReviewId())
                .productId(r.getProduct().getProductId())
                .customerId(r.getCustomer().getCustomerId())
                .customerName(r.getCustomer().getUser().getFullName())
                .rating(r.getRating())
                .title(r.getTitle())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .build();
    }
}

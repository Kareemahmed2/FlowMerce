package com.example.flowmerceproject.ProductManagement.dto;

import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

public class ReviewDTOs {

    @Data
    public static class CreateReviewRequest {
        @NotNull(message = "Rating is required")
        @Min(value = 1) @Max(value = 5)
        private Integer rating;
        private String title;
        private String comment;
    }

    @Data
    public static class UpdateReviewRequest {
        @Min(1) @Max(5)
        private Integer rating;
        private String title;
        private String comment;
    }

    @Data
    @Builder
    public static class ReviewResponse {
        private Integer reviewId;
        private Integer productId;
        private Integer customerId;
        private String customerName;
        private Integer rating;
        private String title;
        private String comment;
        private LocalDateTime createdAt;
    }
}
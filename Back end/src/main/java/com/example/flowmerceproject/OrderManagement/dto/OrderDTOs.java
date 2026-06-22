package com.example.flowmerceproject.OrderManagement.dto;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class OrderDTOs {

    // ── REQUESTS

    @Data
    public static class UpdateStatusRequest {
        @NotNull(message = "Status is required")
        private Order.OrderStatus status;
    }

    // ── RESPONSES

    @Data
    @Builder
    public static class OrderItemResponse {
        private Integer orderItemId;
        private Integer productId;
        private String productName;
        private Integer quantity;
        private BigDecimal price;
        private BigDecimal discount;
        private BigDecimal tax;
        private BigDecimal subtotal; // quantity * price
    }

    @Data
    @Builder
    public static class OrderResponse {
        private Integer orderId;
        private Integer customerId;
        private String customerName;
        private Integer storeId;
        private String storeName;
        private Order.OrderStatus status;
        private List<OrderItemResponse> items;
        private BigDecimal subtotal;
        private BigDecimal tax;
        private BigDecimal shippingCost;
        private BigDecimal total;
        private String shippingAddress;
        private String billingAddress;
        private String paymentMethod;
        private String invoiceNumber;
        private LocalDateTime orderDate;
    }

    @Data
    @Builder
    public static class OrderSummary {
        // Lightweight version for list views
        private Integer orderId;
        private Order.OrderStatus status;
        private BigDecimal total;
        private int itemCount;
        private LocalDateTime orderDate;
        private String storeName;
    }

    @Data
    @Builder
    public static class CustomerSummary {
        // One row per distinct customer who has ordered from the store
        private Integer customerId;
        private String name;
        private String email;
        private String phone;
        private String lastShippingAddress;
        private int ordersCount;
        private BigDecimal totalSpent;
        private LocalDateTime lastOrderDate;
        private LocalDateTime joinDate;
    }
}
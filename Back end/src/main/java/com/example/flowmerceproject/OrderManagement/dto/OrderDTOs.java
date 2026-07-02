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

        /**
         * Optional. Only meaningful when status == SHIPPED — names a carrier
         * ("DHL"/"ARAMEX"/"BOSTA") that the store has configured and enabled in
         * Settings → Integrations. When present, a real shipment is created with
         * that carrier using the store's own credentials. Omit to mark the order
         * SHIPPED without creating a real shipment (e.g. no carrier configured yet).
         */
        private String carrier;
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
        private String trackingNumber;
        private String shippingCarrier;
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
        private String customerName;
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
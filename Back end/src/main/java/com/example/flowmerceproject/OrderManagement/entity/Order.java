package com.example.flowmerceproject.OrderManagement.entity;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Order {

    public enum OrderStatus {
        PENDING,      // order placed, waiting for payment
        CONFIRMED,    // payment successful
        SHIPPED,      // handed to delivery provider
        DELIVERED,    // received by customer
        CANCELLED     // cancelled before shipping
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Integer orderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @CreationTimestamp
    @Column(name = "order_date", updatable = false)
    private LocalDateTime orderDate;

    @Column(name = "shipping_address", columnDefinition = "TEXT")
    private String shippingAddress;

    @Column(name = "billing_address", columnDefinition = "TEXT")
    private String billingAddress;

    @Column(name = "subtotal", precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "tax", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal tax = BigDecimal.ZERO;

    @Column(name = "shipping_cost", precision = 10, scale = 2)
    private BigDecimal shippingCost;

    @Column(name = "total", precision = 10, scale = 2)
    private BigDecimal total;

    // STRIPE, MADA, STC_PAY
    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    /** Denormalized convenience copy of Shipment.trackingNumber for list/detail views. */
    @Column(name = "tracking_number", length = 100)
    private String trackingNumber;

    /** Denormalized convenience copy of Shipment.carrier ("DHL"/"ARAMEX"/"BOSTA"). */
    @Column(name = "shipping_carrier", length = 20)
    private String shippingCarrier;

    /**
     * Client-supplied (or server-generated) key for the whole place-order request —
     * same key the payment step dedupes on. Unique constraint is the DB-level safety
     * net against a duplicate order being created when two near-simultaneous retries
     * of the same checkout both miss the Redis fast-path check (see OrderService).
     */
    @Column(name = "idempotency_key", length = 36, unique = true)
    private String idempotencyKey;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL,
            orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Invoice invoice;
}
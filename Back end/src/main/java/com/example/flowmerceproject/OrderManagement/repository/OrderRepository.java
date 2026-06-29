package com.example.flowmerceproject.OrderManagement.repository;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Integer> {

    // Customer views their orders
    List<Order> findByCustomer_CustomerIdOrderByOrderDateDesc(Integer customerId);

    // Merchant views orders for their store
    List<Order> findByStore_StoreIdOrderByOrderDateDesc(Integer storeId);

    // Filter by status
    List<Order> findByStore_StoreIdAndStatus(Integer storeId, Order.OrderStatus status);

    // Count orders per store — used in analytics
    long countByStore_StoreId(Integer storeId);

    // Order-level idempotency safety net — see OrderService.findOrderByIdempotencyKey
    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    // Eager-loads items + products in one query so consumers running outside a JPA
    // session (RabbitMQ listener threads) can access lazy associations without
    // triggering LazyInitializationException.
    @Query("SELECT o FROM Order o JOIN FETCH o.items i JOIN FETCH i.product WHERE o.orderId = :orderId")
    Optional<Order> findByIdWithItems(@Param("orderId") Integer orderId);
}
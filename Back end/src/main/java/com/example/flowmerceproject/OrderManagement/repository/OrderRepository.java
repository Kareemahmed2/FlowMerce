package com.example.flowmerceproject.OrderManagement.repository;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}
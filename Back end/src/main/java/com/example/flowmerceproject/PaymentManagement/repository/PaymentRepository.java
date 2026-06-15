package com.example.flowmerceproject.PaymentManagement.repository;

import com.example.flowmerceproject.PaymentManagement.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Integer> {
    Optional<Payment> findByIdempotencyKey(String idempotencyKey);
    Optional<Payment> findByOrder_OrderId(Integer orderId);
    List<Payment> findByOrder_Customer_CustomerIdOrderByCreatedAtDesc(Integer customerId);
    List<Payment> findByOrder_Store_StoreIdOrderByCreatedAtDesc(Integer storeId);
}

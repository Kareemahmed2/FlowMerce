package com.example.flowmerceproject.OrderManagement.repository;

import com.example.flowmerceproject.OrderManagement.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Integer> {
    Optional<Invoice> findByOrder_OrderId(Integer orderId);
    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
}
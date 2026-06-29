package com.example.flowmerceproject.ShippingManagement.repository;

import com.example.flowmerceproject.ShippingManagement.entity.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, Integer> {

    Optional<Shipment> findByOrder_OrderId(Integer orderId);
}

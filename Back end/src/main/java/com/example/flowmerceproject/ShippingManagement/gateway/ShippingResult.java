package com.example.flowmerceproject.ShippingManagement.gateway;

import com.example.flowmerceproject.ShippingManagement.entity.Shipment.ShipmentStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ShippingResult {
    private boolean success;
    private ShipmentStatus status;
    private String trackingNumber;
    private String labelUrl;
    private String carrierResponse;
    private String failureReason;
}

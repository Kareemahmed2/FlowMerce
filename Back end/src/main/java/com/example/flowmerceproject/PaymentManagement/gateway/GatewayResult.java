package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GatewayResult {
    private boolean success;
    private PaymentStatus status;
    private String transactionReference;
    private String gatewayResponse;
    private String redirectUrl;
    private String failureReason;
}

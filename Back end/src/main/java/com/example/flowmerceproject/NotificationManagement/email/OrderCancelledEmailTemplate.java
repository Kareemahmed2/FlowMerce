package com.example.flowmerceproject.NotificationManagement.email;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class OrderCancelledEmailTemplate extends BaseEmailTemplate {

    private final Integer orderId;
    private final String storeName;

    @Override
    public String getSubject() {
        return "Order #" + orderId + " Has Been Cancelled";
    }

    @Override
    protected String buildBodyContent() {
        return """
               <h2>Order Cancelled</h2>
               <p>Your order <strong>#%d</strong> from <strong>%s</strong> has been cancelled.</p>
               <div class="highlight-box">
                 <strong>Order #%d — Cancelled</strong><br>
                 <span>If a payment was made, a refund will be processed to your original payment method.</span>
               </div>
               <p>If you did not request this cancellation or have questions, please contact support through your account.</p>
               <p>We hope to see you again at FlowMerce.</p>
               """.formatted(orderId, storeName, orderId);
    }
}

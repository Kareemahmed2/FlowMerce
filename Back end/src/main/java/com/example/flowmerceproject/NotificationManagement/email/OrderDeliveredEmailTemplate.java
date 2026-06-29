package com.example.flowmerceproject.NotificationManagement.email;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class OrderDeliveredEmailTemplate extends BaseEmailTemplate {

    private final Integer orderId;
    private final String storeName;

    @Override
    public String getSubject() {
        return "Your Order #" + orderId + " Has Been Delivered";
    }

    @Override
    protected String buildBodyContent() {
        return """
               <h2>Your Order Has Arrived!</h2>
               <p>Great news! Your order <strong>#%d</strong> from <strong>%s</strong> has been delivered.</p>
               <div class="highlight-box">
                 <strong>Order #%d — Delivered</strong><br>
                 <span>We hope everything arrived in perfect condition.</span>
               </div>
               <p>If you have any issues with your order, please contact the store directly through your account.</p>
               <p>Thank you for shopping with FlowMerce!</p>
               """.formatted(orderId, storeName, orderId);
    }
}

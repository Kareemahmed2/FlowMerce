package com.example.flowmerceproject.NotificationManagement.email;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class OrderShippedEmailTemplate extends BaseEmailTemplate {

    private final Integer orderId;
    private final String storeName;
    private final String trackingNumber;
    private final String carrier;

    @Override
    public String getSubject() {
        return "Your Order #" + orderId + " Has Been Shipped";
    }

    @Override
    protected String buildBodyContent() {
        StringBuilder sb = new StringBuilder();
        sb.append("<h2>Your Order Is On Its Way!</h2>");
        sb.append("<p>Your order from <strong>").append(storeName)
          .append("</strong> has been shipped and is heading to you.</p>");

        sb.append("<div class=\"highlight-box\">")
          .append("<strong>Order #").append(orderId).append("</strong><br>");

        if (carrier != null && !carrier.isBlank()) {
            sb.append("<span>Carrier: <strong>").append(carrier).append("</strong></span><br>");
        }
        if (trackingNumber != null && !trackingNumber.isBlank()) {
            sb.append("<span>Tracking Number: <strong>").append(trackingNumber).append("</strong></span>");
        }
        sb.append("</div>");

        sb.append("<p>You can use the tracking number above to follow your shipment's progress with the carrier's website.</p>");
        sb.append("<p>Thank you for your order!</p>");
        return sb.toString();
    }
}

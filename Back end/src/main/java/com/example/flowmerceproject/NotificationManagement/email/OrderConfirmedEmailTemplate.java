package com.example.flowmerceproject.NotificationManagement.email;

import com.example.flowmerceproject.OrderManagement.entity.OrderItem;
import lombok.RequiredArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@RequiredArgsConstructor
public class OrderConfirmedEmailTemplate extends BaseEmailTemplate {

    private final Integer orderId;
    private final String storeName;
    private final String shippingAddress;
    private final List<OrderItem> items;
    private final BigDecimal subtotal;
    private final BigDecimal shippingCost;
    private final BigDecimal tax;
    private final BigDecimal total;
    private final String currency;

    @Override
    public String getSubject() {
        return "Order #" + orderId + " Confirmed — " + storeName;
    }

    @Override
    protected String buildBodyContent() {
        StringBuilder sb = new StringBuilder();
        sb.append("<h2>Your Order is Confirmed!</h2>");
        sb.append("<p>Great news! Your order from <strong>").append(storeName)
          .append("</strong> has been confirmed and is being prepared.</p>");

        sb.append("<div class=\"highlight-box\">")
          .append("<strong>Order #").append(orderId).append("</strong><br>")
          .append("<span>Shipping to: ").append(shippingAddress).append("</span>")
          .append("</div>");

        sb.append("<table class=\"items\">")
          .append("<thead><tr>")
          .append("<th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th>")
          .append("</tr></thead><tbody>");

        for (OrderItem item : items) {
            BigDecimal lineTotal = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()))
                    .subtract(item.getDiscount());
            sb.append("<tr>")
              .append("<td>").append(item.getProduct().getName()).append("</td>")
              .append("<td>").append(item.getQuantity()).append("</td>")
              .append("<td>").append(currency).append(" ").append(item.getPrice()).append("</td>")
              .append("<td>").append(currency).append(" ").append(lineTotal).append("</td>")
              .append("</tr>");
        }
        sb.append("</tbody></table>");

        sb.append("<div class=\"totals\">")
          .append("<div>Subtotal: ").append(currency).append(" ").append(subtotal).append("</div>")
          .append("<div>Shipping: ").append(currency).append(" ").append(shippingCost).append("</div>")
          .append("<div>Tax: ").append(currency).append(" ").append(tax).append("</div>")
          .append("<div class=\"total-row\">Total: ").append(currency).append(" ").append(total).append("</div>")
          .append("</div>");

        sb.append("<p style=\"margin-top:24px;\">We will notify you once your order ships. Thank you for shopping with us!</p>");
        return sb.toString();
    }
}

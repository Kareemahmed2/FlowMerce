package com.example.flowmerceproject.NotificationManagement.email;

import com.example.flowmerceproject.OrderManagement.entity.OrderItem;
import lombok.RequiredArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RequiredArgsConstructor
public class PaymentConfirmedEmailTemplate extends BaseEmailTemplate {

    private final Integer orderId;
    private final String invoiceNumber;
    private final LocalDateTime issuedAt;
    private final BigDecimal amount;
    private final String currency;
    private final String paymentMethod;
    private final List<OrderItem> items;
    private final BigDecimal subtotal;
    private final BigDecimal shippingCost;
    private final BigDecimal tax;
    private final BigDecimal total;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    @Override
    public String getSubject() {
        return "Payment Confirmed — Invoice " + invoiceNumber;
    }

    @Override
    protected String buildBodyContent() {
        StringBuilder sb = new StringBuilder();
        sb.append("<h2>Payment Confirmed</h2>");
        sb.append("<p>Your payment has been successfully processed. Below is your invoice summary.</p>");

        sb.append("<div class=\"highlight-box\">")
          .append("<strong>Invoice: ").append(invoiceNumber).append("</strong><br>")
          .append("<span>Order #").append(orderId).append("</span><br>")
          .append("<span>Date: ").append(issuedAt != null ? issuedAt.format(DATE_FMT) : "—").append("</span><br>")
          .append("<span>Payment method: ").append(formatMethod(paymentMethod)).append("</span>")
          .append("</div>");

        sb.append("<table class=\"items\">")
          .append("<thead><tr>")
          .append("<th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th>")
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
          .append("<div class=\"total-row\">Amount Paid: ").append(currency).append(" ").append(amount).append("</div>")
          .append("</div>");

        sb.append("<p style=\"margin-top:24px;\">Please keep this email as your receipt. Thank you for your purchase!</p>");
        return sb.toString();
    }

    private String formatMethod(String method) {
        if (method == null) return "—";
        return switch (method.toUpperCase()) {
            case "STRIPE"           -> "Stripe";
            case "PAYMOB"           -> "Paymob";
            case "FAWRY_PAY"        -> "Fawry";
            case "BANK_TRANSFER"    -> "Bank Transfer";
            case "COD"              -> "Cash on Delivery";
            case "FLOWMERCE_WALLET" -> "FlowMerce Wallet";
            default                 -> method;
        };
    }
}

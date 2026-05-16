package com.example.flowmerceproject.CartManagement.service;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.entity.CartItem;
import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import com.example.flowmerceproject.CartManagement.repository.ShoppingCartRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutService {

    private final ShoppingCartRepository cartRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final CartService cartService;
    private final InventoryService inventoryService;

     //The system is designed to support tax rates via application.properties without touching this code
    @Value("${app.shipping.flat-rate:25.00}")
    private BigDecimal shippingFlatRate;

    @Value("${app.tax.rate:0.00}")
    private BigDecimal taxRate;

    // PROCESS CHECKOUT
    // Step 1: Validate cart is not empty
    // Step 2: Validate stock for all items
    // Step 3: Reserve stock in Inventory (Redis atomic)
    // Step 4: Calculate totals
    // Step 5: Return CheckoutSummary for Order Service
    @Transactional
    public CheckoutSummary processCheckout(String email, CartDTOs.CheckoutRequest request) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = cartRepository.findByCustomer_CustomerId(
                        customer.getCustomerId())
                .orElseThrow(() -> new BadRequestException(
                        "Your cart is empty. Add items before checkout."));

        if (cart.getItems().isEmpty()) {
            throw new BadRequestException("Your cart is empty. Add items before checkout.");
        }

        // Step 2: Validate all items have enough stock
        List<String> stockErrors = new ArrayList<>();
        for (CartItem item : cart.getItems()) {
            boolean available = inventoryService.checkAvailability(
                    item.getProduct().getProductId().longValue(), item.getQuantity());
            if (!available) {
                int currentStock = inventoryService.getAvailableQuantity(
                        item.getProduct().getProductId().longValue());
                stockErrors.add(item.getProduct().getName()
                        + " — requested: " + item.getQuantity()
                        + ", available: " + currentStock);
            }
        }

        if (!stockErrors.isEmpty()) {
            throw new BadRequestException(
                    "Stock issues found:\n" + String.join("\n", stockErrors));
        }

        // Step 3: Reserve stock for all items atomically
        // If any item fails → rollback all previously reserved items
        List<CartItem> reservedItems = new ArrayList<>();
        for (CartItem item : cart.getItems()) {
            boolean reserved = inventoryService.reserveStock(
                    item.getProduct().getProductId().longValue(), item.getQuantity());
            if (!reserved) {
                for (CartItem reservedItem : reservedItems) {
                    inventoryService.releaseStock(
                            reservedItem.getProduct().getProductId().longValue(),
                            reservedItem.getQuantity());
                }
                throw new BadRequestException(
                        "Failed to reserve stock for: " + item.getProduct().getName()
                                + ". Please try again.");
            }
            reservedItems.add(item);
        }

        // Step 4: Calculate totals
        // tax = 0 for MVP — configurable via app.tax.rate in application.properties
        BigDecimal subtotal    = cartService.calculateSubtotal(cart);
        BigDecimal tax         = subtotal.multiply(taxRate);
        BigDecimal shippingCost = shippingFlatRate;
        BigDecimal total       = subtotal.add(tax).add(shippingCost);

        log.info("Checkout processed for customer={}, subtotal={}, tax={}, shipping={}, total={}",
                customer.getCustomerId(), subtotal, tax, shippingCost, total);

        return CheckoutSummary.builder()
                .cartId(cart.getCartId())
                .customerId(customer.getCustomerId())
                .items(cart.getItems())
                .subtotal(subtotal)
                .tax(tax)
                .shippingCost(shippingCost)
                .total(total)
                .shippingAddress(request.getShippingAddress())
                .billingAddress(request.getBillingAddress() != null
                        ? request.getBillingAddress() : request.getShippingAddress())
                .paymentMethod(request.getPaymentMethod())
                .build();
    }

    // CONFIRM ORDER
    // Called after payment success — clears the cart
    @Transactional
    public void confirmOrder(Integer cartId) {
        ShoppingCart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart not found: " + cartId));
        cart.getItems().clear();
        cartRepository.save(cart);
        log.info("Cart cleared after order confirmed: cartId={}", cartId);
    }

    // RELEASE RESERVED STOCK
    // Called on payment failure — returns stock to Inventory
    @Transactional
    public void releaseReservedStock(Integer cartId) {
        ShoppingCart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart not found: " + cartId));
        for (CartItem item : cart.getItems()) {
            inventoryService.releaseStock(
                    item.getProduct().getProductId().longValue(), item.getQuantity());
        }
        log.info("Reserved stock released for cartId={}", cartId);
    }

    // HELPER
    private Customer getCustomerByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException(
                        "Only customers can checkout."));
    }

    // CHECKOUT SUMMARY
    // Passed directly to Order Service after checkout
    @lombok.Builder
    @lombok.Data
    public static class CheckoutSummary {
        private Integer cartId;
        private Integer customerId;
        private List<CartItem> items;
        private BigDecimal subtotal;
        private BigDecimal tax;        // 0 for MVP — configurable via app.tax.rate
        private BigDecimal shippingCost;
        private BigDecimal total;
        private String shippingAddress;
        private String billingAddress;
        private String paymentMethod;
    }
}
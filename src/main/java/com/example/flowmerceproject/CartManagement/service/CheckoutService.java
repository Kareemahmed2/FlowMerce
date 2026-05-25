package com.example.flowmerceproject.CartManagement.service;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.entity.CartItem;
import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import com.example.flowmerceproject.CartManagement.repository.ShoppingCartRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
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
    private final StoreRepository storeRepository;
    private final CartService cartService;
    private final InventoryService inventoryService;

    @Value("${app.shipping.flat-rate:25.00}")
    private BigDecimal shippingFlatRate;

    @Value("${app.tax.rate:0.00}")
    private BigDecimal taxRate;

    @Transactional
    public CheckoutSummary processCheckout(String email, CartDTOs.CheckoutRequest request) {
        Customer customer = getCustomerByEmail(email);

        Store store = storeRepository.findById(request.getStoreId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Store not found: " + request.getStoreId()));

        ShoppingCart cart = cartRepository.findByCustomer_CustomerIdAndStore_StoreId(
                        customer.getCustomerId(), store.getStoreId())
                .orElseThrow(() -> new BadRequestException(
                        "Your cart for this store is empty. Add items before checkout."));

        if (cart.getItems().isEmpty()) {
            throw new BadRequestException("Your cart is empty. Add items before checkout.");
        }

        List<String> stockErrors = new ArrayList<>();
        for (CartItem item : cart.getItems()) {
            if (!item.getProduct().getIsActive()) {
                throw new BadRequestException(
                        "Product '" + item.getProduct().getName() + "' is no longer available.");
            }
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

        List<CartItem> reservedItems = new ArrayList<>();
        for (CartItem item : cart.getItems()) {
            boolean reserved = inventoryService.reserveStock(
                    item.getProduct().getProductId().longValue(), item.getQuantity());
            if (!reserved) {
                for (CartItem r : reservedItems) {
                    inventoryService.releaseStock(
                            r.getProduct().getProductId().longValue(), r.getQuantity());
                }
                throw new BadRequestException(
                        "Failed to reserve stock for: " + item.getProduct().getName()
                                + ". Please try again.");
            }
            reservedItems.add(item);
        }

        BigDecimal subtotal     = cartService.calculateSubtotal(cart);
        BigDecimal tax          = subtotal.multiply(taxRate);
        BigDecimal shippingCost = shippingFlatRate;
        BigDecimal total        = subtotal.add(tax).add(shippingCost);

        log.info("Checkout processed for customer={}, store={}, total={}",
                customer.getCustomerId(), store.getStoreId(), total);

        return CheckoutSummary.builder()
                .cartId(cart.getCartId())
                .customerId(customer.getCustomerId())
                .storeId(store.getStoreId())
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

    // Called by OrderService after the order is persisted.
    // Confirms stock (deducts from inventory.quantity) and clears the cart.
    @Transactional
    public void confirmOrder(Integer cartId) {
        ShoppingCart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cart not found: " + cartId));

        for (CartItem item : cart.getItems()) {
            inventoryService.confirmOrder(
                    item.getProduct().getProductId().longValue(),
                    item.getQuantity());
        }

        cart.getItems().clear();
        cartRepository.save(cart);
    }

    @Transactional
    public void releaseReservedStock(Integer cartId) {
        ShoppingCart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cart not found: " + cartId));
        for (CartItem item : cart.getItems()) {
            inventoryService.releaseStock(
                    item.getProduct().getProductId().longValue(), item.getQuantity());
        }
    }

    private Customer getCustomerByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can checkout."));
    }

    @lombok.Builder
    @lombok.Data
    public static class CheckoutSummary {
        private Integer cartId;
        private Integer customerId;
        private Integer storeId;
        private List<CartItem> items;
        private BigDecimal subtotal;
        private BigDecimal tax;
        private BigDecimal shippingCost;
        private BigDecimal total;
        private String shippingAddress;
        private String billingAddress;
        private String paymentMethod;
    }
}

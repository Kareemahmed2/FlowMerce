package com.example.flowmerceproject.OrderManagement.service;

import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.CartManagement.service.CheckoutService.CheckoutSummary;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.OrderManagement.dto.OrderDTOs;
import com.example.flowmerceproject.OrderManagement.entity.Invoice;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.entity.OrderItem;
import com.example.flowmerceproject.OrderManagement.repository.InvoiceRepository;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.example.flowmerceproject.UserManagement.service.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final InvoiceRepository invoiceRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final MerchantRepository merchantRepository;
    private final InventoryService inventoryService;
    private final CheckoutService checkoutService;
    private final SseService sseService;

    // CREATE ORDER
    // Called after checkout is processed
    // Receives CheckoutSummary from CheckoutService

    @Transactional
    public OrderDTOs.OrderResponse createOrder(String email,
                                               CheckoutSummary checkoutSummary) {
        Customer customer = getCustomerByEmail(email);

        // Get store from first cart item
        if (checkoutSummary.getItems().isEmpty()) {
            throw new BadRequestException("Cannot create order with empty cart.");
        }

        Store store = checkoutSummary.getItems().get(0)
                .getProduct().getStore();

        // Build order
        Order order = Order.builder()
                .customer(customer)
                .store(store)
                .status(Order.OrderStatus.PENDING)
                .shippingAddress(checkoutSummary.getShippingAddress())
                .billingAddress(checkoutSummary.getBillingAddress())
                .subtotal(checkoutSummary.getSubtotal())
                .tax(checkoutSummary.getTax())
                .shippingCost(checkoutSummary.getShippingCost())
                .total(checkoutSummary.getTotal())
                .paymentMethod(checkoutSummary.getPaymentMethod())
                .build();

        orderRepository.save(order);

        // Build order items from cart items
        List<OrderItem> orderItems = checkoutSummary.getItems().stream()
                .map(cartItem -> OrderItem.builder()
                        .order(order)
                        .product(cartItem.getProduct())
                        .quantity(cartItem.getQuantity())
                        .price(cartItem.getPriceAtAdd())
                        .discount(BigDecimal.ZERO)
                        .tax(BigDecimal.ZERO)
                        .build())
                .collect(Collectors.toList());

        order.setItems(orderItems);
        orderRepository.save(order);

        // Generate invoice automatically
        Invoice invoice = generateInvoice(order);

        // Confirm stock permanently in inventory
        checkoutSummary.getItems().forEach(cartItem ->
                inventoryService.confirmOrder(
                        cartItem.getProduct().getProductId().longValue(),
                        cartItem.getQuantity()
                )
        );

        // Clear the cart after successful order
        checkoutService.confirmOrder(checkoutSummary.getCartId());

        // Notify customer via SSE
        sseService.sendOrderUpdate(
                email,
                order.getOrderId(),
                order.getStatus().name()
        );

        log.info("Order created: orderId={}, customer={}, total={}",
                order.getOrderId(), customer.getCustomerId(), order.getTotal());

        return toResponse(order, invoice);
    }

    // GET MY ORDERS — customer views their orders
    public List<OrderDTOs.OrderSummary> getMyOrders(String email) {
        Customer customer = getCustomerByEmail(email);
        return orderRepository
                .findByCustomer_CustomerIdOrderByOrderDateDesc(
                        customer.getCustomerId())
                .stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    // GET ORDER DETAILS — customer views one order
    public OrderDTOs.OrderResponse getOrderById(String email, Integer orderId) {
        Customer customer = getCustomerByEmail(email);
        Order order = findOrderOrThrow(orderId);

        if (!order.getCustomer().getCustomerId()
                .equals(customer.getCustomerId())) {
            throw new ForbiddenException("You do not have access to this order.");
        }

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId)
                .orElse(null);
        return toResponse(order, invoice);
    }


    // GET STORE ORDERS — merchant views their store orders
    public List<OrderDTOs.OrderSummary> getStoreOrders(String email, Integer storeId) {
        verifyMerchantOwnsStore(email, storeId);
        return orderRepository
                .findByStore_StoreIdOrderByOrderDateDesc(storeId)
                .stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    // UPDATE ORDER STATUS — merchant updates status
    // PENDING → CONFIRMED → SHIPPED → DELIVERED
    @Transactional
    public OrderDTOs.OrderResponse updateStatus(String email, Integer orderId,
                                                OrderDTOs.UpdateStatusRequest request) {
        Order order = findOrderOrThrow(orderId);
        verifyMerchantOwnsStore(email, order.getStore().getStoreId());

        validateStatusTransition(order.getStatus(), request.getStatus());

        order.setStatus(request.getStatus());
        orderRepository.save(order);

        // Notify customer about status change via SSE
        sseService.sendOrderUpdate(
                order.getCustomer().getUser().getEmail(),
                order.getOrderId(),
                order.getStatus().name()
        );

        log.info("Order status updated: orderId={}, newStatus={}",
                orderId, request.getStatus());

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId).orElse(null);
        return toResponse(order, invoice);
    }

    // CANCEL ORDER — customer cancels their order
    // Only allowed when status is PENDING
    @Transactional
    public OrderDTOs.OrderResponse cancelOrder(String email, Integer orderId) {
        Customer customer = getCustomerByEmail(email);
        Order order = findOrderOrThrow(orderId);

        if (!order.getCustomer().getCustomerId()
                .equals(customer.getCustomerId())) {
            throw new ForbiddenException("You do not have access to this order.");
        }

        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new BadRequestException(
                    "Order cannot be cancelled. Current status: "
                            + order.getStatus());
        }

        // Release reserved stock back to inventory
        order.getItems().forEach(item ->
                inventoryService.releaseStock(
                        item.getProduct().getProductId().longValue(),
                        item.getQuantity()
                )
        );

        order.setStatus(Order.OrderStatus.CANCELLED);
        orderRepository.save(order);

        // Notify customer
        sseService.sendOrderUpdate(email, orderId, "CANCELLED");

        log.info("Order cancelled: orderId={}, customer={}",
                orderId, customer.getCustomerId());

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId).orElse(null);
        return toResponse(order, invoice);
    }


    // ADMIN: GET ALL ORDERS
    public List<OrderDTOs.OrderSummary> getAllOrders() {
        return orderRepository.findAll()
                .stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }


    // GENERATE INVOICE
    // Auto-generated when order is created
    // Format: INV-2026-00001
    private Invoice generateInvoice(Order order) {
        String year = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("yyyy"));
        String invoiceNumber = "INV-" + year + "-"
                + String.format("%05d", order.getOrderId());

        Invoice invoice = Invoice.builder()
                .order(order)
                .invoiceNumber(invoiceNumber)
                .build();

        invoiceRepository.save(invoice);

        log.info("Invoice generated: {} for orderId={}",
                invoiceNumber, order.getOrderId());
        return invoice;
    }

    // VALIDATE STATUS TRANSITION
    // Prevents invalid status jumps e.g. PENDING → DELIVERED
    private void validateStatusTransition(Order.OrderStatus current,
                                          Order.OrderStatus next) {
        boolean valid = switch (current) {
            case PENDING   -> next == Order.OrderStatus.CONFIRMED
                    || next == Order.OrderStatus.CANCELLED;
            case CONFIRMED -> next == Order.OrderStatus.SHIPPED;
            case SHIPPED   -> next == Order.OrderStatus.DELIVERED;
            default        -> false;
        };

        if (!valid) {
            throw new BadRequestException(
                    "Invalid status transition: "
                            + current + " → " + next);
        }
    }

    // HELPERS
    private Customer getCustomerByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException(
                        "Only customers can access orders."));
    }

    private Order findOrderOrThrow(Integer orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found: " + orderId));
    }

    private void verifyMerchantOwnsStore(String email, Integer storeId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        var merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Merchant profile not found"));
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Store not found: " + storeId));
        if (!store.getMerchant().getMerchantId()
                .equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
    }

    public OrderDTOs.OrderResponse toResponse(Order order, Invoice invoice) {
        List<OrderDTOs.OrderItemResponse> items = order.getItems().stream()
                .map(item -> OrderDTOs.OrderItemResponse.builder()
                        .orderItemId(item.getOrderItemId())
                        .productId(item.getProduct().getProductId())
                        .productName(item.getProduct().getName())
                        .quantity(item.getQuantity())
                        .price(item.getPrice())
                        .discount(item.getDiscount())
                        .tax(item.getTax())
                        .subtotal(item.getPrice()
                                .multiply(BigDecimal.valueOf(item.getQuantity())))
                        .build())
                .collect(Collectors.toList());

        return OrderDTOs.OrderResponse.builder()
                .orderId(order.getOrderId())
                .customerId(order.getCustomer().getCustomerId())
                .customerName(order.getCustomer().getUser().getFullName())
                .storeId(order.getStore().getStoreId())
                .storeName(order.getStore().getStoreName())
                .status(order.getStatus())
                .items(items)
                .subtotal(order.getSubtotal())
                .tax(order.getTax())
                .shippingCost(order.getShippingCost())
                .total(order.getTotal())
                .shippingAddress(order.getShippingAddress())
                .billingAddress(order.getBillingAddress())
                .paymentMethod(order.getPaymentMethod())
                .invoiceNumber(invoice != null ? invoice.getInvoiceNumber() : null)
                .orderDate(order.getOrderDate())
                .build();
    }

    private OrderDTOs.OrderSummary toSummary(Order order) {
        return OrderDTOs.OrderSummary.builder()
                .orderId(order.getOrderId())
                .status(order.getStatus())
                .total(order.getTotal())
                .itemCount(order.getItems().size())
                .orderDate(order.getOrderDate())
                .storeName(order.getStore().getStoreName())
                .build();
    }
}
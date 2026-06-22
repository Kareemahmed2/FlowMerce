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
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
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
import com.example.flowmerceproject.OrderManagement.event.OrderEventPublisher;
import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.entity.Payment;
import com.example.flowmerceproject.PaymentManagement.repository.PaymentRepository;
import com.example.flowmerceproject.PaymentManagement.service.PaymentServiceImpl;
import com.example.flowmerceproject.UserManagement.service.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final MerchantRepository merchantRepository;
    private final InventoryService inventoryService;
    private final CheckoutService checkoutService;
    private final SseService sseService;
    private final OrderEventPublisher orderEventPublisher;
    private final PaymentRepository paymentRepository;
    private final PaymentServiceImpl paymentService;

    // ── CREATE ORDER ────────────────────────────────────────────────────────────
    // Called after checkout reserves stock. Stock is confirmed (permanently
    // deducted) exactly once — inside checkoutService.confirmOrder().
    @Transactional
    public OrderDTOs.OrderResponse createOrder(String email, CheckoutSummary checkoutSummary) {
        Customer customer = getCustomerByEmail(email);

        if (checkoutSummary.getItems().isEmpty()) {
            throw new BadRequestException("Cannot create order with empty cart.");
        }

        // Store comes from the CheckoutSummary (guaranteed single-store by cart scoping)
        Store store = storeRepository.findById(checkoutSummary.getStoreId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Store not found: " + checkoutSummary.getStoreId()));

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

        List<OrderItem> orderItems = checkoutSummary.getItems().stream()
                .map(cartItem -> {
                    Product product = productRepository.findById(cartItem.getProductId())
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "Product not found: " + cartItem.getProductId()));
                    return OrderItem.builder()
                            .order(order)
                            .product(product)
                            .quantity(cartItem.getQuantity())
                            .price(cartItem.getPriceAtAdd())
                            .discount(BigDecimal.ZERO)
                            .tax(BigDecimal.ZERO)
                            .build();
                })
                .collect(Collectors.toList());

        order.setItems(orderItems);
        orderRepository.save(order);

        Invoice invoice = generateInvoice(order);

        // Confirm stock permanently and clear cart — single call, no duplication
        checkoutService.confirmOrder(checkoutSummary.getCartId());

        sseService.sendOrderUpdate(email, order.getOrderId(), order.getStatus().name());

        log.info("Order created: orderId={}, customer={}, store={}, total={}",
                order.getOrderId(), customer.getCustomerId(),
                store.getStoreId(), order.getTotal());

        return toResponse(order, invoice);
    }

    // ── CUSTOMER: MY ORDERS ─────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<OrderDTOs.OrderSummary> getMyOrders(String email) {
        Customer customer = getCustomerByEmail(email);
        return orderRepository
                .findByCustomer_CustomerIdOrderByOrderDateDesc(customer.getCustomerId())
                .stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    // ── CUSTOMER: ORDER DETAILS ─────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public OrderDTOs.OrderResponse getOrderById(String email, Integer orderId) {
        Customer customer = getCustomerByEmail(email);
        Order order = findOrderOrThrow(orderId);

        if (!order.getCustomer().getCustomerId().equals(customer.getCustomerId())) {
            throw new ForbiddenException("You do not have access to this order.");
        }

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId).orElse(null);
        return toResponse(order, invoice);
    }

    // ── MERCHANT: STORE ORDER LIST ──────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<OrderDTOs.OrderSummary> getStoreOrders(String email, Integer storeId) {
        verifyMerchantOwnsStore(email, storeId);
        return orderRepository
                .findByStore_StoreIdOrderByOrderDateDesc(storeId)
                .stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    // ── MERCHANT: STORE CUSTOMER LIST ───────────────────────────────────────────
    // One row per distinct customer who has ordered from this store, aggregated
    // server-side (orders count, lifetime spend, last order) — replaces the old
    // frontend-only derivation that had no access to customer email/name.
    @Transactional(readOnly = true)
    public List<OrderDTOs.CustomerSummary> getStoreCustomers(String email, Integer storeId) {
        verifyMerchantOwnsStore(email, storeId);
        List<Order> orders = orderRepository.findByStore_StoreIdOrderByOrderDateDesc(storeId);

        return orders.stream()
                .collect(Collectors.groupingBy(o -> o.getCustomer().getCustomerId()))
                .values().stream()
                .map(this::toCustomerSummary)
                .sorted(java.util.Comparator.comparing(OrderDTOs.CustomerSummary::getTotalSpent).reversed())
                .collect(Collectors.toList());
    }

    private OrderDTOs.CustomerSummary toCustomerSummary(List<Order> customerOrders) {
        List<Order> sorted = customerOrders.stream()
                .sorted(java.util.Comparator.comparing(Order::getOrderDate).reversed())
                .collect(Collectors.toList());
        Order latest = sorted.get(0);
        Customer customer = latest.getCustomer();
        User user = customer.getUser();

        BigDecimal totalSpent = sorted.stream()
                .filter(o -> o.getStatus() != Order.OrderStatus.CANCELLED)
                .map(Order::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return OrderDTOs.CustomerSummary.builder()
                .customerId(customer.getCustomerId())
                .name(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .lastShippingAddress(latest.getShippingAddress())
                .ordersCount(sorted.size())
                .totalSpent(totalSpent)
                .lastOrderDate(latest.getOrderDate())
                .joinDate(user.getCreatedAt())
                .build();
    }

    // ── MERCHANT: STORE ORDER DETAILS ───────────────────────────────────────────
    @Transactional(readOnly = true)
    public OrderDTOs.OrderResponse getOrderDetails(String email, Integer storeId, Integer orderId) {
        verifyMerchantOwnsStore(email, storeId);
        Order order = findOrderOrThrow(orderId);

        if (!order.getStore().getStoreId().equals(storeId)) {
            throw new ForbiddenException("Order does not belong to your store.");
        }

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId).orElse(null);
        return toResponse(order, invoice);
    }

    // ── MERCHANT: UPDATE STATUS ─────────────────────────────────────────────────
    // Full status control: PENDING → CONFIRMED → SHIPPED → DELIVERED | CANCELLED
    @Transactional
    public OrderDTOs.OrderResponse updateStatus(String email, Integer orderId,
                                                OrderDTOs.UpdateStatusRequest request) {
        Order order = findOrderOrThrow(orderId);
        verifyMerchantOwnsStore(email, order.getStore().getStoreId());

        String oldStatus = order.getStatus().name();
        validateStatusTransition(order.getStatus(), request.getStatus());

        order.setStatus(request.getStatus());
        orderRepository.save(order);

        String customerEmail = order.getCustomer().getUser().getEmail();
        String merchantEmail = order.getStore().getMerchant().getUser().getEmail();

        // SSE push + notification persistence both happen in OrderNotificationConsumer,
        // triggered by this event — sending SSE directly here would double-fire it.
        orderEventPublisher.publishStatusChanged(order, oldStatus, customerEmail, merchantEmail);

        log.info("Order status updated: orderId={}, newStatus={}", orderId, request.getStatus());

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId).orElse(null);
        return toResponse(order, invoice);
    }

    // ── CUSTOMER: CANCEL ORDER ──────────────────────────────────────────────────
    // Only allowed when PENDING. Stock is NOT auto-restored — the merchant
    // inspects the returned goods and restocks manually via the inventory API.
    @Transactional
    public OrderDTOs.OrderResponse cancelOrder(String email, Integer orderId) {
        Customer customer = getCustomerByEmail(email);
        Order order = findOrderOrThrow(orderId);

        if (!order.getCustomer().getCustomerId().equals(customer.getCustomerId())) {
            throw new ForbiddenException("You do not have access to this order.");
        }

        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new BadRequestException(
                    "Order cannot be cancelled. Current status: " + order.getStatus());
        }

        order.setStatus(Order.OrderStatus.CANCELLED);
        orderRepository.save(order);

        // Reverse any money that already moved — COD/bank-transfer payments stay
        // PENDING until the merchant collects/confirms them, but wallet payments
        // settle synchronously at checkout, so a still-PENDING order can already
        // have a COMPLETED payment that needs refunding.
        paymentRepository.findByOrder_OrderId(orderId)
                .filter(p -> p.getPaymentStatus() == Payment.PaymentStatus.COMPLETED)
                .ifPresent(payment -> {
                    PaymentDTOs.RefundRequest refundRequest = new PaymentDTOs.RefundRequest();
                    refundRequest.setAmount(payment.getAmount());
                    refundRequest.setReason("Order cancelled by customer");
                    paymentService.refundPayment(payment.getPaymentId(), refundRequest, email);
                });

        String merchantEmail = order.getStore().getMerchant().getUser().getEmail();
        orderEventPublisher.publishStatusChanged(order, "PENDING", email, merchantEmail);

        log.info("Order cancelled: orderId={}, customer={}. " +
                        "Merchant should verify items and restock manually via inventory API.",
                orderId, customer.getCustomerId());

        Invoice invoice = invoiceRepository.findByOrder_OrderId(orderId).orElse(null);
        return toResponse(order, invoice);
    }

    // ── ADMIN: ALL ORDERS (PAGINATED) ───────────────────────────────────────────
    @Transactional(readOnly = true)
    public Page<OrderDTOs.OrderSummary> getAllOrders(Pageable pageable) {
        return orderRepository.findAll(pageable).map(this::toSummary);
    }

    // ── INVOICE GENERATION ──────────────────────────────────────────────────────
    // Format: INV-2026-0000001 (7 digits; supports up to 9.9 M orders per year)
    private Invoice generateInvoice(Order order) {
        String year = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy"));
        String invoiceNumber = "INV-" + year + "-" + String.format("%07d", order.getOrderId());

        Invoice invoice = Invoice.builder()
                .order(order)
                .invoiceNumber(invoiceNumber)
                .build();

        invoiceRepository.save(invoice);

        log.info("Invoice generated: {} for orderId={}", invoiceNumber, order.getOrderId());
        return invoice;
    }

    // ── STATUS MACHINE ──────────────────────────────────────────────────────────
    // Merchants have full control. Both customer cancel (PENDING→CANCELLED) and
    // merchant cancel are valid paths.
    private void validateStatusTransition(Order.OrderStatus current, Order.OrderStatus next) {
        boolean valid = switch (current) {
            case PENDING   -> next == Order.OrderStatus.CONFIRMED
                           || next == Order.OrderStatus.CANCELLED;
            case CONFIRMED -> next == Order.OrderStatus.SHIPPED
                           || next == Order.OrderStatus.CANCELLED;
            case SHIPPED   -> next == Order.OrderStatus.DELIVERED;
            default        -> false;
        };

        if (!valid) {
            throw new BadRequestException(
                    "Invalid status transition: " + current + " → " + next);
        }
    }

    // ── HELPERS ─────────────────────────────────────────────────────────────────
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
        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
    }

    // ── MAPPERS ─────────────────────────────────────────────────────────────────
    public OrderDTOs.OrderResponse toResponse(Order order, Invoice invoice) {
        List<OrderDTOs.OrderItemResponse> items = order.getItems().stream()
                .map(item -> {
                    // Subtotal respects line-level discount: (price − discount) × qty
                    BigDecimal lineSubtotal = item.getPrice()
                            .subtract(item.getDiscount())
                            .multiply(BigDecimal.valueOf(item.getQuantity()));
                    return OrderDTOs.OrderItemResponse.builder()
                            .orderItemId(item.getOrderItemId())
                            .productId(item.getProduct().getProductId())
                            .productName(item.getProduct().getName())
                            .quantity(item.getQuantity())
                            .price(item.getPrice())
                            .discount(item.getDiscount())
                            .tax(item.getTax())
                            .subtotal(lineSubtotal)
                            .build();
                })
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

    /**
     * INT-14: Returns the items of a past order as AddToCartRequest objects so the
     * controller can re-add them to the buyer's cart (reorder flow).
     */
    @Transactional(readOnly = true)
    public java.util.List<com.example.flowmerceproject.CartManagement.dto.CartDTOs.AddToCartRequest>
            getOrderItemsForReorder(String email, Integer orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Customer customer = customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can reorder."));
        if (!order.getCustomer().getCustomerId().equals(customer.getCustomerId())) {
            throw new ForbiddenException("You do not have access to this order.");
        }
        return order.getItems().stream()
                .map(item -> {
                    var req = new com.example.flowmerceproject.CartManagement.dto.CartDTOs.AddToCartRequest();
                    req.setProductId(item.getProduct().getProductId());
                    req.setQuantity(item.getQuantity());
                    return req;
                })
                .toList();
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

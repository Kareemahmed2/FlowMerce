package com.example.flowmerceproject.OrderManagement.service;

import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.CartManagement.service.CheckoutService.CheckoutSummary;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.OrderManagement.dto.OrderDTOs;
import com.example.flowmerceproject.OrderManagement.entity.Invoice;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.entity.OrderItem;
import com.example.flowmerceproject.OrderManagement.event.OrderEventPublisher;
import com.example.flowmerceproject.OrderManagement.repository.InvoiceRepository;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.entity.Payment;
import com.example.flowmerceproject.PaymentManagement.repository.PaymentRepository;
import com.example.flowmerceproject.PaymentManagement.service.PaymentServiceImpl;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.ShippingManagement.service.ShippingService;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.example.flowmerceproject.UserManagement.service.SseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("OrderService Unit Tests")
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private MerchantRepository merchantRepository;
    @Mock private InventoryService inventoryService;
    @Mock private CheckoutService checkoutService;
    @Mock private SseService sseService;
    @Mock private OrderEventPublisher orderEventPublisher;
    @Mock private PaymentRepository paymentRepository;
    @Mock private PaymentServiceImpl paymentService;
    @Mock private ShippingService shippingService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks
    private OrderService orderService;

    private User customerUser;
    private Customer customer;
    private User merchantUser;
    private Merchant merchant;
    private Store store;
    private Product product;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        customerUser = User.builder()
                .userId(1)
                .email("customer@test.com")
                .fullName("Test Customer")
                .build();

        customer = Customer.builder()
                .customerId(1)
                .user(customerUser)
                .build();

        merchantUser = User.builder()
                .userId(2)
                .email("merchant@test.com")
                .fullName("Test Merchant")
                .build();

        merchant = Merchant.builder()
                .merchantId(1)
                .user(merchantUser)
                .build();

        store = Store.builder()
                .storeId(1)
                .storeName("Test Store")
                .merchant(merchant)
                .build();

        product = Product.builder()
                .productId(1)
                .name("Test Product")
                .basePrice(new BigDecimal("100.00"))
                .store(store)
                .isActive(true)
                .build();
    }

    // ── U-ORD-01: Create order with valid checkout summary ────────────────────

    @Test
    @DisplayName("U-ORD-01: createOrder - creates order, invoice, confirms stock")
    void createOrder_validCheckout_createsOrderAndInvoice() {
        CheckoutSummary summary = buildCheckoutSummary(1, BigDecimal.TEN);
        Invoice invoice = Invoice.builder()
                .invoiceId(1)
                .invoiceNumber("INV-2026-0000001")
                .build();

        when(userRepository.findByEmail("customer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(storeRepository.findById(1)).thenReturn(Optional.of(store));
        when(productRepository.findById(1)).thenReturn(Optional.of(product));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setOrderId(1);
            if (o.getItems() == null) o.setItems(new ArrayList<>());
            return o;
        });
        when(invoiceRepository.save(any(Invoice.class))).thenReturn(invoice);

        OrderDTOs.OrderResponse result = orderService.createOrder(
                "customer@test.com", summary, "key-001");

        assertThat(result).isNotNull();
        verify(checkoutService).confirmOrder(summary.getCartId());
        verify(invoiceRepository).save(any(Invoice.class));
        verify(sseService).sendOrderUpdate(eq("customer@test.com"), any(), anyString());
    }

    // ── U-ORD-02: Idempotency — Redis hit returns cached order ───────────────

    @Test
    @DisplayName("U-ORD-02: findOrderByIdempotencyKey - Redis hit returns existing order")
    void findOrderByIdempotencyKey_redisCacheHit_returnsExistingOrder() {
        Order existingOrder = buildOrder(Order.OrderStatus.PENDING);
        existingOrder.setItems(new ArrayList<>());
        existingOrder.setIdempotencyKey("key-001");

        when(valueOps.get("order:idempotency:key-001")).thenReturn("1");
        when(orderRepository.findById(1)).thenReturn(Optional.of(existingOrder));
        when(invoiceRepository.findByOrder_OrderId(1)).thenReturn(Optional.empty());

        Optional<OrderDTOs.OrderResponse> result =
                orderService.findOrderByIdempotencyKey("key-001");

        assertThat(result).isPresent();
        verify(orderRepository, never()).findByIdempotencyKey(anyString());
    }

    // ── U-ORD-03: createOrder - empty items throws BadRequestException ────────

    @Test
    @DisplayName("U-ORD-03: createOrder - empty cart throws BadRequestException")
    void createOrder_emptyCart_throwsBadRequestException() {
        CheckoutSummary emptyCheckout = CheckoutSummary.builder()
                .cartId(1)
                .storeId(1)
                .items(Collections.emptyList())
                .subtotal(BigDecimal.ZERO)
                .tax(BigDecimal.ZERO)
                .shippingCost(BigDecimal.ZERO)
                .total(BigDecimal.ZERO)
                .build();

        when(userRepository.findByEmail("customer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));

        assertThatThrownBy(() ->
                orderService.createOrder("customer@test.com", emptyCheckout, "key-empty"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("empty cart");
    }

    // ── U-ORD-04: cancelOrder - PENDING → CANCELLED ───────────────────────────

    @Test
    @DisplayName("U-ORD-04: cancelOrder - PENDING order is cancelled")
    void cancelOrder_pendingOrder_statusChangedToCancelled() {
        Order order = buildOrder(Order.OrderStatus.PENDING);
        order.setItems(new ArrayList<>());

        when(userRepository.findByEmail("customer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(orderRepository.findById(10)).thenReturn(Optional.of(order));
        when(paymentRepository.findByOrder_OrderId(10)).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(invoiceRepository.findByOrder_OrderId(10)).thenReturn(Optional.empty());

        OrderDTOs.OrderResponse result =
                orderService.cancelOrder("customer@test.com", 10);

        assertThat(result.getStatus()).isEqualTo(Order.OrderStatus.CANCELLED);
        verify(orderRepository).save(argThat(o -> o.getStatus() == Order.OrderStatus.CANCELLED));
    }

    // ── U-ORD-05: cancelOrder - non-PENDING throws BadRequestException ────────

    @Test
    @DisplayName("U-ORD-05: cancelOrder - SHIPPED order throws BadRequestException")
    void cancelOrder_shippedOrder_throwsBadRequestException() {
        Order order = buildOrder(Order.OrderStatus.SHIPPED);

        when(userRepository.findByEmail("customer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(orderRepository.findById(10)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.cancelOrder("customer@test.com", 10))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot be cancelled");
    }

    // ── U-ORD-06: updateStatus CONFIRMED → SHIPPED publishes event ────────────

    @Test
    @DisplayName("U-ORD-06: updateStatus - CONFIRMED to SHIPPED publishes event")
    void updateStatus_confirmedToShipped_publishesEvent() {
        Order order = buildOrder(Order.OrderStatus.CONFIRMED);
        order.setItems(new ArrayList<>());

        OrderDTOs.UpdateStatusRequest req = new OrderDTOs.UpdateStatusRequest();
        req.setStatus(Order.OrderStatus.SHIPPED);

        when(userRepository.findByEmail("merchant@test.com")).thenReturn(Optional.of(merchantUser));
        when(merchantRepository.findByUser_UserId(2)).thenReturn(Optional.of(merchant));
        when(storeRepository.findById(1)).thenReturn(Optional.of(store));
        when(orderRepository.findById(10)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(invoiceRepository.findByOrder_OrderId(10)).thenReturn(Optional.empty());

        OrderDTOs.OrderResponse result =
                orderService.updateStatus("merchant@test.com", 10, req);

        assertThat(result.getStatus()).isEqualTo(Order.OrderStatus.SHIPPED);
        verify(orderEventPublisher).publishStatusChanged(
                any(Order.class), eq("CONFIRMED"), anyString(), anyString());
    }

    // ── U-ORD-07: updateStatus — invalid transition throws BadRequestException ─

    @Test
    @DisplayName("U-ORD-07: updateStatus - invalid transition SHIPPED → PENDING throws")
    void updateStatus_invalidTransition_throwsBadRequestException() {
        Order order = buildOrder(Order.OrderStatus.SHIPPED);

        OrderDTOs.UpdateStatusRequest req = new OrderDTOs.UpdateStatusRequest();
        req.setStatus(Order.OrderStatus.PENDING);

        when(userRepository.findByEmail("merchant@test.com")).thenReturn(Optional.of(merchantUser));
        when(merchantRepository.findByUser_UserId(2)).thenReturn(Optional.of(merchant));
        when(storeRepository.findById(1)).thenReturn(Optional.of(store));
        when(orderRepository.findById(10)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.updateStatus("merchant@test.com", 10, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid status transition");
    }

    // ── U-ORD-08: getOrderById — wrong customer throws ForbiddenException ─────

    @Test
    @DisplayName("U-ORD-08: getOrderById - wrong customer throws ForbiddenException")
    void getOrderById_wrongCustomer_throwsForbiddenException() {
        Customer otherCustomer = Customer.builder().customerId(99).user(customerUser).build();
        Order order = buildOrder(Order.OrderStatus.PENDING);
        order.setCustomer(otherCustomer);

        when(userRepository.findByEmail("customer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(orderRepository.findById(10)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.getOrderById("customer@test.com", 10))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── U-ORD-09: getOrderItemsForReorder — returns items as AddToCartRequest ─

    @Test
    @DisplayName("U-ORD-09: getOrderItemsForReorder - returns AddToCartRequests")
    void getOrderItemsForReorder_ownOrder_returnsCartRequests() {
        Order order = buildOrder(Order.OrderStatus.DELIVERED);
        OrderItem item = OrderItem.builder()
                .product(product)
                .quantity(3)
                .build();
        order.setItems(List.of(item));

        when(orderRepository.findById(10)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("customer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));

        var requests = orderService.getOrderItemsForReorder("customer@test.com", 10);

        assertThat(requests).hasSize(1);
        assertThat(requests.get(0).getProductId()).isEqualTo(1);
        assertThat(requests.get(0).getQuantity()).isEqualTo(3);
    }

    // ── U-ORD-10: getAllOrders (admin) — paginated ────────────────────────────

    @Test
    @DisplayName("U-ORD-10: getAllOrders - returns paginated results")
    void getAllOrders_returnsPage() {
        Order order = buildOrder(Order.OrderStatus.PENDING);
        order.setItems(new ArrayList<>());
        Page<Order> page = new PageImpl<>(List.of(order));

        when(orderRepository.findAll(any(Pageable.class))).thenReturn(page);

        Page<OrderDTOs.OrderSummary> result = orderService.getAllOrders(Pageable.ofSize(20));

        assertThat(result.getContent()).hasSize(1);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Order buildOrder(Order.OrderStatus status) {
        return Order.builder()
                .orderId(10)
                .customer(customer)
                .store(store)
                .status(status)
                .subtotal(new BigDecimal("100.00"))
                .tax(BigDecimal.ZERO)
                .shippingCost(new BigDecimal("25.00"))
                .total(new BigDecimal("125.00"))
                .paymentMethod("CASH_ON_DELIVERY")
                .orderDate(LocalDateTime.now())
                .shippingAddress("{\"fullName\":\"Test Customer\"}")
                .build();
    }

    private CheckoutSummary buildCheckoutSummary(int productId, BigDecimal price) {
        com.example.flowmerceproject.CartManagement.dto.CartDTOs.CartItemResponse item =
                com.example.flowmerceproject.CartManagement.dto.CartDTOs.CartItemResponse.builder()
                        .productId(productId)
                        .quantity(1)
                        .priceAtAdd(price)
                        .build();

        return CheckoutSummary.builder()
                .cartId(1)
                .storeId(1)
                .items(List.of(item))
                .subtotal(price)
                .tax(BigDecimal.ZERO)
                .shippingCost(new BigDecimal("25.00"))
                .total(price.add(new BigDecimal("25.00")))
                .paymentMethod("CASH_ON_DELIVERY")
                .shippingAddress("{\"fullName\":\"Test Customer\"}")
                .build();
    }
}

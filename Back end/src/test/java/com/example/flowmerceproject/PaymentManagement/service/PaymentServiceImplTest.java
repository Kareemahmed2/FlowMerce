package com.example.flowmerceproject.PaymentManagement.service;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.entity.Payment;
import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import com.example.flowmerceproject.PaymentManagement.event.PaymentEventPublisher;
import com.example.flowmerceproject.PaymentManagement.gateway.GatewayResult;
import com.example.flowmerceproject.PaymentManagement.gateway.PaymentGatewayAdapter;
import com.example.flowmerceproject.PaymentManagement.repository.PaymentRepository;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PaymentServiceImpl Unit Tests")
class PaymentServiceImplTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private PaymentGatewayAdapter codAdapter;
    @Mock private WalletService walletService;
    @Mock private PaymentEventPublisher eventPublisher;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    private User customerUser;
    private User merchantUser;
    private Customer customer;
    private Merchant merchant;
    private Store store;
    private Order order;
    private Payment completedPayment;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        customerUser = User.builder().userId(1).email("buyer@test.com").fullName("Buyer").build();
        merchantUser = User.builder().userId(2).email("merchant@test.com").fullName("Merchant").build();
        customer = Customer.builder().customerId(1).user(customerUser).build();
        merchant = Merchant.builder().merchantId(1).user(merchantUser).build();
        store = Store.builder().storeId(1).storeName("Test Store").merchant(merchant).build();

        order = Order.builder()
                .orderId(10)
                .customer(customer)
                .store(store)
                .total(new BigDecimal("150.00"))
                .status(Order.OrderStatus.PENDING)
                .build();

        completedPayment = Payment.builder()
                .paymentId(5)
                .order(order)
                .paymentMethod("CASH_ON_DELIVERY")
                .paymentStatus(PaymentStatus.COMPLETED)
                .amount(new BigDecimal("150.00"))
                .currency("EGP")
                .gateway("COD")
                .build();

        // Wire up the COD adapter as the supported adapter
        when(codAdapter.supports("CASH_ON_DELIVERY")).thenReturn(true);
        when(codAdapter.getProviderName()).thenReturn("COD");

        // Inject adapter list via reflection (List<PaymentGatewayAdapter> gateways)
        // Since @InjectMocks injects via constructor/setter, we need to inject the list
        // in a way Mockito supports — using the field injection via a spy or re-init.
        // Workaround: set it using reflection in each test that needs adapter dispatch.
    }

    // ── U-PAY-01: Initiate COD payment — PENDING created ─────────────────────

    @Test
    @DisplayName("U-PAY-01: initiatePayment - COD creates PENDING payment")
    void initiatePayment_cod_createsPendingPayment() throws Exception {
        // Reconstruct service with real gateway list
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        PaymentDTOs.InitiatePaymentRequest request = PaymentDTOs.InitiatePaymentRequest.builder()
                .orderId(10)
                .amount(new BigDecimal("150.00"))
                .paymentMethod("CASH_ON_DELIVERY")
                .idempotencyKey("pay-key-001")
                .build();

        when(valueOps.get("payment:idempotency:pay-key-001")).thenReturn(null);
        when(orderRepository.findById(10)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(paymentRepository.findByOrder_OrderId(10)).thenReturn(Optional.empty());
        when(codAdapter.process(eq(10), any(), eq("CASH_ON_DELIVERY"), eq("buyer@test.com")))
                .thenReturn(GatewayResult.builder()
                        .success(true)
                        .status(PaymentStatus.PENDING)
                        .transactionReference("COD-REF-001")
                        .build());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setPaymentId(5);
            return p;
        });
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"paymentId\":5}");

        PaymentDTOs.PaymentResponse result = service.initiatePayment(request, "buyer@test.com");

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PENDING);
        verify(codAdapter).process(eq(10), any(), eq("CASH_ON_DELIVERY"), eq("buyer@test.com"));
    }

    // ── U-PAY-02: initiatePayment — idempotency cache hit returns cached ──────

    @Test
    @DisplayName("U-PAY-02: initiatePayment - idempotency cache hit returns existing payment")
    void initiatePayment_idempotencyCacheHit_returnsExistingPayment() throws Exception {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        PaymentDTOs.InitiatePaymentRequest request = PaymentDTOs.InitiatePaymentRequest.builder()
                .orderId(10)
                .amount(new BigDecimal("150.00"))
                .paymentMethod("CASH_ON_DELIVERY")
                .idempotencyKey("pay-key-001")
                .build();

        when(valueOps.get("payment:idempotency:pay-key-001")).thenReturn("{\"paymentId\":5}");
        when(objectMapper.readValue(anyString(), eq(java.util.Map.class)))
                .thenReturn(java.util.Map.of("paymentId", 5));
        when(paymentRepository.findById(5)).thenReturn(Optional.of(completedPayment));

        PaymentDTOs.PaymentResponse result = service.initiatePayment(request, "buyer@test.com");

        assertThat(result).isNotNull();
        verify(orderRepository, never()).findById(any());
        verify(codAdapter, never()).process(any(), any(), any(), any());
    }

    // ── U-PAY-03: confirmPayment — PENDING → COMPLETED ───────────────────────

    @Test
    @DisplayName("U-PAY-03: confirmPayment - PENDING payment becomes COMPLETED")
    void confirmPayment_pendingPayment_becomesCompleted() {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        Payment pendingPayment = Payment.builder()
                .paymentId(5)
                .order(order)
                .paymentMethod("CASH_ON_DELIVERY")
                .paymentStatus(PaymentStatus.PENDING)
                .amount(new BigDecimal("150.00"))
                .currency("EGP")
                .gateway("COD")
                .build();

        PaymentDTOs.ConfirmPaymentRequest confirmRequest = new PaymentDTOs.ConfirmPaymentRequest();
        confirmRequest.setReference("MERCHANT-CONFIRM-REF");

        when(paymentRepository.findById(5)).thenReturn(Optional.of(pendingPayment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentDTOs.PaymentResponse result =
                service.confirmPayment(5, confirmRequest, "merchant@test.com");

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        verify(eventPublisher).publishSucceeded(any(), anyString(), anyString());
    }

    // ── U-PAY-04: refundPayment — COMPLETED → REFUNDED ───────────────────────

    @Test
    @DisplayName("U-PAY-04: refundPayment - full refund changes status to REFUNDED")
    void refundPayment_fullRefund_statusBecomesRefunded() {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        when(codAdapter.supports("CASH_ON_DELIVERY")).thenReturn(true);

        PaymentDTOs.RefundRequest refundRequest = new PaymentDTOs.RefundRequest();
        refundRequest.setAmount(new BigDecimal("150.00"));
        refundRequest.setReason("Customer cancelled");

        when(paymentRepository.findById(5)).thenReturn(Optional.of(completedPayment));
        when(codAdapter.refund(any(), any(), any(), any()))
                .thenReturn(GatewayResult.builder()
                        .success(true)
                        .status(PaymentStatus.REFUNDED)
                        .build());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentDTOs.PaymentResponse result =
                service.refundPayment(5, refundRequest, "buyer@test.com");

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(eventPublisher).publishRefunded(any(), anyString(), anyString());
    }

    // ── U-PAY-05: refundPayment — partial refund → PARTIALLY_REFUNDED ────────

    @Test
    @DisplayName("U-PAY-05: refundPayment - partial refund changes status to PARTIALLY_REFUNDED")
    void refundPayment_partialRefund_statusBecomesPartiallyRefunded() {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        when(codAdapter.supports("CASH_ON_DELIVERY")).thenReturn(true);

        PaymentDTOs.RefundRequest refundRequest = new PaymentDTOs.RefundRequest();
        refundRequest.setAmount(new BigDecimal("50.00"));
        refundRequest.setReason("Partial return");

        when(paymentRepository.findById(5)).thenReturn(Optional.of(completedPayment));
        when(codAdapter.refund(any(), any(), any(), any()))
                .thenReturn(GatewayResult.builder()
                        .success(true)
                        .status(PaymentStatus.PARTIALLY_REFUNDED)
                        .build());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentDTOs.PaymentResponse result =
                service.refundPayment(5, refundRequest, "buyer@test.com");

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
    }

    // ── U-PAY-06: refundPayment — PENDING payment throws BadRequest ───────────

    @Test
    @DisplayName("U-PAY-06: refundPayment - PENDING payment throws BadRequestException")
    void refundPayment_pendingPayment_throwsBadRequestException() {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        Payment pendingPayment = Payment.builder()
                .paymentId(5)
                .order(order)
                .paymentStatus(PaymentStatus.PENDING)
                .amount(new BigDecimal("150.00"))
                .build();

        PaymentDTOs.RefundRequest refundRequest = new PaymentDTOs.RefundRequest();
        refundRequest.setAmount(new BigDecimal("150.00"));

        when(paymentRepository.findById(5)).thenReturn(Optional.of(pendingPayment));

        assertThatThrownBy(() -> service.refundPayment(5, refundRequest, "buyer@test.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Only completed payments");
    }

    // ── U-PAY-07: refundPayment — amount > payment.amount throws BadRequest ───

    @Test
    @DisplayName("U-PAY-07: refundPayment - refund amount exceeds payment throws BadRequestException")
    void refundPayment_amountExceedsPayment_throwsBadRequestException() {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        PaymentDTOs.RefundRequest refundRequest = new PaymentDTOs.RefundRequest();
        refundRequest.setAmount(new BigDecimal("999.00"));

        when(paymentRepository.findById(5)).thenReturn(Optional.of(completedPayment));

        assertThatThrownBy(() -> service.refundPayment(5, refundRequest, "buyer@test.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("exceeds payment amount");
    }

    // ── U-PAY-08: confirmPayment — already COMPLETED throws BadRequest ─────────

    @Test
    @DisplayName("U-PAY-08: confirmPayment - already COMPLETED throws BadRequestException")
    void confirmPayment_alreadyCompleted_throwsBadRequestException() {
        PaymentServiceImpl service = new PaymentServiceImpl(
                paymentRepository, orderRepository, userRepository, customerRepository,
                List.of(codAdapter), walletService, eventPublisher, redisTemplate, objectMapper);

        PaymentDTOs.ConfirmPaymentRequest confirmRequest = new PaymentDTOs.ConfirmPaymentRequest();

        when(paymentRepository.findById(5)).thenReturn(Optional.of(completedPayment));

        assertThatThrownBy(() ->
                service.confirmPayment(5, confirmRequest, "merchant@test.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot be confirmed");
    }
}

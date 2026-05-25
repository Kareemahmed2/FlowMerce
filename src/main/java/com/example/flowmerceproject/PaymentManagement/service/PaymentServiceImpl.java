package com.example.flowmerceproject.PaymentManagement.service;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.entity.Payment;
import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import com.example.flowmerceproject.PaymentManagement.entity.WalletTransaction.ReferenceType;
import com.example.flowmerceproject.PaymentManagement.event.PaymentEventPublisher;
import com.example.flowmerceproject.PaymentManagement.gateway.GatewayResult;
import com.example.flowmerceproject.PaymentManagement.gateway.PaymentGatewayAdapter;
import com.example.flowmerceproject.PaymentManagement.repository.PaymentRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl {

    private static final String IDEMPOTENCY_PREFIX = "payment:idempotency:";
    private static final Duration IDEMPOTENCY_TTL  = Duration.ofHours(24);

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final List<PaymentGatewayAdapter> gateways;
    private final WalletService walletService;
    private final PaymentEventPublisher eventPublisher;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // ── INITIATE ──────────────────────────────────────────────────────────────

    @Transactional
    public PaymentDTOs.PaymentResponse initiatePayment(
            PaymentDTOs.InitiatePaymentRequest request, String customerEmail) {

        String idempotencyKey = request.getIdempotencyKey() != null
                ? request.getIdempotencyKey()
                : UUID.randomUUID().toString();

        // Idempotency check — return cached response if key already processed
        String cached = redisTemplate.opsForValue().get(IDEMPOTENCY_PREFIX + idempotencyKey);
        if (cached != null) {
            try {
                Integer cachedPaymentId = objectMapper.readValue(cached, Map.class)
                        .get("paymentId") instanceof Integer id ? id
                        : Integer.parseInt(objectMapper.readValue(cached, Map.class)
                        .get("paymentId").toString());
                Payment existing = paymentRepository.findById(cachedPaymentId).orElse(null);
                if (existing != null) {
                    log.info("Idempotency hit: key={}, paymentId={}", idempotencyKey, cachedPaymentId);
                    return toResponse(existing);
                }
            } catch (Exception e) {
                log.warn("Failed to parse cached idempotency value: {}", e.getMessage());
            }
        }

        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found: " + request.getOrderId()));

        // Verify caller owns this order
        Customer customer = resolveCustomer(customerEmail);
        if (!order.getCustomer().getCustomerId().equals(customer.getCustomerId())) {
            throw new ForbiddenException("This order does not belong to you.");
        }

        // Check order hasn't already been paid
        paymentRepository.findByOrder_OrderId(order.getOrderId()).ifPresent(p -> {
            if (p.getPaymentStatus() == PaymentStatus.COMPLETED) {
                throw new BadRequestException("Order #" + order.getOrderId() + " is already paid.");
            }
        });

        PaymentGatewayAdapter adapter = resolveAdapter(request.getPaymentMethod());

        // Save initial PENDING record
        Payment payment = paymentRepository.save(Payment.builder()
                .order(order)
                .paymentMethod(request.getPaymentMethod())
                .paymentStatus(PaymentStatus.PENDING)
                .amount(request.getAmount())
                .currency("EGP")
                .idempotencyKey(idempotencyKey)
                .gateway(adapter.getProviderName())
                .build());

        // Process via adapter
        GatewayResult result = adapter.process(
                order.getOrderId(), request.getAmount(),
                request.getPaymentMethod(), customerEmail);

        payment.setPaymentStatus(result.getStatus());
        payment.setTransactionReference(result.getTransactionReference());
        payment.setGatewayResponse(result.getGatewayResponse());
        payment.setRedirectUrl(result.getRedirectUrl());
        payment.setFailureReason(result.getFailureReason());
        if (result.getStatus() == PaymentStatus.COMPLETED) {
            payment.setPaidAt(LocalDateTime.now());
        }
        payment = paymentRepository.save(payment);

        // Cache idempotency key
        cacheIdempotencyKey(idempotencyKey, payment.getPaymentId(), result.getStatus().name());

        String merchantEmail = order.getStore().getMerchant().getUser().getEmail();

        // Publish events — consumers handle DB notifications
        if (result.getStatus() == PaymentStatus.COMPLETED) {
            eventPublisher.publishSucceeded(payment, customerEmail, merchantEmail);
        } else if (result.getStatus() == PaymentStatus.FAILED) {
            eventPublisher.publishFailed(payment, customerEmail, merchantEmail);
        } else {
            eventPublisher.publishInitiated(payment, customerEmail, merchantEmail);
        }

        log.info("Payment initiated: paymentId={}, orderId={}, method={}, status={}",
                payment.getPaymentId(), order.getOrderId(),
                request.getPaymentMethod(), result.getStatus());

        return toResponse(payment);
    }

    // ── CONFIRM (COD / BANK TRANSFER) ─────────────────────────────────────────

    @Transactional
    public PaymentDTOs.PaymentResponse confirmPayment(Integer paymentId,
                                                      PaymentDTOs.ConfirmPaymentRequest request,
                                                      String merchantEmail) {
        Payment payment = findOrThrow(paymentId);

        if (payment.getPaymentStatus() != PaymentStatus.PENDING
                && payment.getPaymentStatus() != PaymentStatus.PROCESSING) {
            throw new BadRequestException(
                    "Payment cannot be confirmed. Current status: " + payment.getPaymentStatus());
        }

        if (request.getReference() != null) {
            payment.setTransactionReference(request.getReference());
        }
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(LocalDateTime.now());
        payment = paymentRepository.save(payment);

        String customerEmail = payment.getOrder().getCustomer().getUser().getEmail();
        eventPublisher.publishSucceeded(payment, customerEmail, merchantEmail);

        log.info("Payment confirmed: paymentId={}", paymentId);
        return toResponse(payment);
    }

    // ── REFUND ────────────────────────────────────────────────────────────────

    @Transactional
    public PaymentDTOs.PaymentResponse refundPayment(Integer paymentId,
                                                     PaymentDTOs.RefundRequest request,
                                                     String callerEmail) {
        Payment payment = findOrThrow(paymentId);

        if (payment.getPaymentStatus() != PaymentStatus.COMPLETED) {
            throw new BadRequestException(
                    "Only completed payments can be refunded. Status: " + payment.getPaymentStatus());
        }
        if (request.getAmount().compareTo(payment.getAmount()) > 0) {
            throw new BadRequestException(
                    "Refund amount (" + request.getAmount() + ") exceeds payment amount (" + payment.getAmount() + ").");
        }

        PaymentGatewayAdapter adapter = resolveAdapter(payment.getPaymentMethod());
        GatewayResult result = adapter.refund(
                payment.getTransactionReference(), request.getAmount(), callerEmail);

        // For wallet payments — reverse the wallet transactions
        if ("FLOWMERCE_WALLET".equals(payment.getGateway())
                || "WALLET".equals(payment.getGateway())) {
            Order order = payment.getOrder();
            Customer customer = order.getCustomer();
            walletService.creditCustomer(customer, request.getAmount(),
                    "Refund for order #" + order.getOrderId(), payment.getPaymentId());
            walletService.debitMerchant(order.getStore().getMerchant(), request.getAmount(),
                    "Refund issued for order #" + order.getOrderId(), payment.getPaymentId());
        }

        boolean isPartial = request.getAmount().compareTo(payment.getAmount()) < 0;
        payment.setPaymentStatus(isPartial ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED);
        payment.setGatewayResponse(result.getGatewayResponse());
        payment = paymentRepository.save(payment);

        String customerEmail = payment.getOrder().getCustomer().getUser().getEmail();
        String merchantEmail = payment.getOrder().getStore().getMerchant().getUser().getEmail();
        eventPublisher.publishRefunded(payment, customerEmail, merchantEmail);

        log.info("Payment refunded: paymentId={}, amount={}", paymentId, request.getAmount());
        return toResponse(payment);
    }

    // ── QUERIES ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PaymentDTOs.PaymentResponse getPayment(Integer paymentId, String email) {
        return toResponse(findOrThrow(paymentId));
    }

    @Transactional(readOnly = true)
    public PaymentDTOs.PaymentResponse getPaymentByOrder(Integer orderId, String email) {
        Payment payment = paymentRepository.findByOrder_OrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No payment found for order: " + orderId));
        return toResponse(payment);
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    private Payment findOrThrow(Integer paymentId) {
        return paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Payment not found: " + paymentId));
    }

    private PaymentGatewayAdapter resolveAdapter(String paymentMethod) {
        return gateways.stream()
                .filter(g -> g.supports(paymentMethod))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Unsupported payment method: " + paymentMethod
                                + ". Supported: COD, BANK_TRANSFER, FLOWMERCE_WALLET, STRIPE, PAYMOB, FAWRY_PAY"));
    }

    private Customer resolveCustomer(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can initiate payments."));
    }

    private void cacheIdempotencyKey(String key, Integer paymentId, String status) {
        try {
            String value = objectMapper.writeValueAsString(
                    Map.of("paymentId", paymentId, "status", status));
            redisTemplate.opsForValue().set(
                    IDEMPOTENCY_PREFIX + key, value, IDEMPOTENCY_TTL);
        } catch (Exception e) {
            log.warn("Failed to cache idempotency key: {}", e.getMessage());
        }
    }

    public PaymentDTOs.PaymentResponse toResponse(Payment p) {
        return PaymentDTOs.PaymentResponse.builder()
                .paymentId(p.getPaymentId())
                .orderId(p.getOrder().getOrderId())
                .paymentMethod(p.getPaymentMethod())
                .status(p.getPaymentStatus())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .gateway(p.getGateway())
                .transactionReference(p.getTransactionReference())
                .redirectUrl(p.getRedirectUrl())
                .failureReason(p.getFailureReason())
                .paidAt(p.getPaidAt())
                .createdAt(p.getCreatedAt())
                .build();
    }
}

package com.example.flowmerceproject.OrderManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.OrderManagement.dto.OrderDTOs;
import com.example.flowmerceproject.OrderManagement.service.OrderService;
import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.service.PaymentServiceImpl;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final CheckoutService checkoutService;
    private final PaymentServiceImpl paymentService;

    // ── BUYER ENDPOINTS ───────────────────────────────────────────────────────

    // POST /api/orders/place
    @PostMapping("/place")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<PaymentDTOs.OrderPlaceResponse>> placeOrder(
            Principal principal,
            @Valid @RequestBody CartDTOs.CheckoutRequest request) {

        CheckoutService.CheckoutSummary summary =
                checkoutService.processCheckout(principal.getName(), request);

        OrderDTOs.OrderResponse order =
                orderService.createOrder(principal.getName(), summary);

        PaymentDTOs.InitiatePaymentRequest paymentRequest =
                PaymentDTOs.InitiatePaymentRequest.builder()
                        .orderId(order.getOrderId())
                        .amount(order.getTotal())
                        .paymentMethod(request.getPaymentMethod())
                        .idempotencyKey(request.getIdempotencyKey())
                        .build();

        PaymentDTOs.PaymentResponse payment =
                paymentService.initiatePayment(paymentRequest, principal.getName());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        PaymentDTOs.OrderPlaceResponse.builder()
                                .order(order)
                                .payment(payment)
                                .build(),
                        "Order placed successfully"));
    }

    // GET /api/orders/me
    @GetMapping("/me")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<List<OrderDTOs.OrderSummary>>> getMyOrders(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getMyOrders(principal.getName())));
    }

    // GET /api/orders/{orderId}
    @GetMapping("/{orderId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<OrderDTOs.OrderResponse>> getOrder(
            Principal principal,
            @PathVariable Integer orderId) {
        return ResponseEntity.ok(ApiResponse.ok(
                orderService.getOrderById(principal.getName(), orderId)));
    }

    // POST /api/orders/{orderId}/cancel  (state change — not a deletion)
    @PostMapping("/{orderId}/cancel")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<OrderDTOs.OrderResponse>> cancelOrder(
            Principal principal,
            @PathVariable Integer orderId) {
        return ResponseEntity.ok(ApiResponse.ok(
                orderService.cancelOrder(principal.getName(), orderId),
                "Order cancelled successfully"));
    }

    // ── MERCHANT ENDPOINTS ────────────────────────────────────────────────────

    // GET /api/orders/store/{storeId}
    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<OrderDTOs.OrderSummary>>> getStoreOrders(
            Principal principal,
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                orderService.getStoreOrders(principal.getName(), storeId)));
    }

    // GET /api/orders/store/{storeId}/{orderId} — full order detail for merchant
    @GetMapping("/store/{storeId}/{orderId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<OrderDTOs.OrderResponse>> getOrderDetails(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer orderId) {
        return ResponseEntity.ok(ApiResponse.ok(
                orderService.getOrderDetails(principal.getName(), storeId, orderId)));
    }

    // PUT /api/orders/{orderId}/status
    @PutMapping("/{orderId}/status")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<OrderDTOs.OrderResponse>> updateStatus(
            Principal principal,
            @PathVariable Integer orderId,
            @Valid @RequestBody OrderDTOs.UpdateStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                orderService.updateStatus(principal.getName(), orderId, request),
                "Order status updated"));
    }

    // ── ADMIN ENDPOINTS ───────────────────────────────────────────────────────

    // GET /api/orders/admin/all?page=0&size=20&sort=orderDate,desc
    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<OrderDTOs.OrderSummary>> getAllOrders(
            @PageableDefault(size = 20, sort = "orderDate",
                             direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(orderService.getAllOrders(pageable));
    }
}

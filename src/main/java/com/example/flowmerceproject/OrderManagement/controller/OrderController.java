package com.example.flowmerceproject.OrderManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.OrderManagement.dto.OrderDTOs;
import com.example.flowmerceproject.OrderManagement.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

    // POST /api/orders/place
    // Step 1: Process checkout (reserve stock)
    // Step 2: Create order from CheckoutSummary
    @PostMapping("/place")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<OrderDTOs.OrderResponse> placeOrder(
            Principal principal,
            @Valid @RequestBody CartDTOs.CheckoutRequest request) {

        // Step 1 — checkout: validate + reserve stock
        CheckoutService.CheckoutSummary summary =
                checkoutService.processCheckout(principal.getName(), request);

        // Step 2 — create order from checkout summary
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.createOrder(principal.getName(), summary));
    }

    // GET /api/orders/me — customer views their orders
    @GetMapping("/me")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<List<OrderDTOs.OrderSummary>> getMyOrders(
            Principal principal) {
        return ResponseEntity.ok(orderService.getMyOrders(principal.getName()));
    }

    // GET /api/orders/{orderId} — customer views order details
    @GetMapping("/{orderId}")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<OrderDTOs.OrderResponse> getOrder(
            Principal principal,
            @PathVariable Integer orderId) {
        return ResponseEntity.ok(
                orderService.getOrderById(principal.getName(), orderId));
    }

    // DELETE /api/orders/{orderId}/cancel — customer cancels order
    @DeleteMapping("/{orderId}/cancel")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<OrderDTOs.OrderResponse> cancelOrder(
            Principal principal,
            @PathVariable Integer orderId) {
        return ResponseEntity.ok(
                orderService.cancelOrder(principal.getName(), orderId));
    }

    // ── MERCHANT ENDPOINTS ────────────────────────

    // GET /api/orders/store/{storeId} — merchant views store orders
    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<List<OrderDTOs.OrderSummary>> getStoreOrders(
            Principal principal,
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(
                orderService.getStoreOrders(principal.getName(), storeId));
    }

    // PUT /api/orders/{orderId}/status — merchant updates order status
    @PutMapping("/{orderId}/status")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<OrderDTOs.OrderResponse> updateStatus(
            Principal principal,
            @PathVariable Integer orderId,
            @Valid @RequestBody OrderDTOs.UpdateStatusRequest request) {
        return ResponseEntity.ok(
                orderService.updateStatus(principal.getName(), orderId, request));
    }

    // ── ADMIN ENDPOINTS ───────────────────────────

    // GET /api/orders/admin/all
    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<OrderDTOs.OrderSummary>> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }
}
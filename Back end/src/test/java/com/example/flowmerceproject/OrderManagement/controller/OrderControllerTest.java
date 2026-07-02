package com.example.flowmerceproject.OrderManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.service.CartService;
import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.OrderManagement.dto.OrderDTOs;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.service.OrderService;
import com.example.flowmerceproject.PaymentManagement.service.PaymentServiceImpl;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.GlobalExceptionHandler;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrderController Slice Tests (standaloneSetup)")
class OrderControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock private OrderService orderService;
    @Mock private CheckoutService checkoutService;
    @Mock private PaymentServiceImpl paymentService;
    @Mock private CartService cartService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new OrderController(orderService, checkoutService, paymentService, cartService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private OrderDTOs.OrderSummary buildSummary() {
        return OrderDTOs.OrderSummary.builder()
                .orderId(1)
                .status(Order.OrderStatus.PENDING)
                .total(new BigDecimal("150.00"))
                .itemCount(1)
                .orderDate(LocalDateTime.now())
                .storeName("Test Store")
                .build();
    }

    // ── GET /orders/me ────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /orders/me → 200 with list of orders")
    void getMyOrders_authenticatedBuyer_returns200() throws Exception {
        when(orderService.getMyOrders("buyer@test.com")).thenReturn(List.of(buildSummary()));

        mockMvc.perform(get("/orders/me")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    // ── GET /orders/{id} happy path ───────────────────────────────────────────

    @Test
    @DisplayName("GET /orders/{id} → 200 with order details")
    void getOrder_ownOrder_returns200() throws Exception {
        OrderDTOs.OrderResponse response = OrderDTOs.OrderResponse.builder()
                .orderId(1)
                .status(Order.OrderStatus.PENDING)
                .items(Collections.emptyList())
                .build();

        when(orderService.getOrderById("buyer@test.com", 1)).thenReturn(response);

        mockMvc.perform(get("/orders/1")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderId").value(1));
    }

    // ── GET /orders/{id} — not found returns 404 ──────────────────────────────

    @Test
    @DisplayName("GET /orders/{id} for non-existent order → 404")
    void getOrder_notFound_returns404() throws Exception {
        when(orderService.getOrderById("buyer@test.com", 999))
                .thenThrow(new ResourceNotFoundException("Order not found: 999"));

        mockMvc.perform(get("/orders/999")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isNotFound());
    }

    // ── GET /orders/{id} — forbidden returns 403 ──────────────────────────────

    @Test
    @DisplayName("GET /orders/{id} for another customer's order → 403")
    void getOrder_otherCustomer_returns403() throws Exception {
        when(orderService.getOrderById("buyer@test.com", 10))
                .thenThrow(new ForbiddenException("You do not have access to this order."));

        mockMvc.perform(get("/orders/10")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isForbidden());
    }

    // ── POST /orders/{id}/cancel happy path ───────────────────────────────────

    @Test
    @DisplayName("POST /orders/{id}/cancel → 200")
    void cancelOrder_pendingOrder_returns200() throws Exception {
        OrderDTOs.OrderResponse response = OrderDTOs.OrderResponse.builder()
                .orderId(1)
                .status(Order.OrderStatus.CANCELLED)
                .items(Collections.emptyList())
                .build();

        when(orderService.cancelOrder("buyer@test.com", 1)).thenReturn(response);

        mockMvc.perform(post("/orders/1/cancel")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    // ── POST /orders/{id}/cancel — SHIPPED throws 400 ─────────────────────────

    @Test
    @DisplayName("POST /orders/{id}/cancel on SHIPPED order → 400")
    void cancelOrder_shippedOrder_returns400() throws Exception {
        when(orderService.cancelOrder("buyer@test.com", 1))
                .thenThrow(new BadRequestException("Order cannot be cancelled. Current status: SHIPPED"));

        mockMvc.perform(post("/orders/1/cancel")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isBadRequest());
    }

    // ── PUT /orders/{id}/status (merchant) ────────────────────────────────────

    @Test
    @DisplayName("PUT /orders/{id}/status → 200 with updated status")
    void updateStatus_validRequest_returns200() throws Exception {
        OrderDTOs.UpdateStatusRequest request = new OrderDTOs.UpdateStatusRequest();
        request.setStatus(Order.OrderStatus.CONFIRMED);

        OrderDTOs.OrderResponse response = OrderDTOs.OrderResponse.builder()
                .orderId(1)
                .status(Order.OrderStatus.CONFIRMED)
                .items(Collections.emptyList())
                .build();

        when(orderService.updateStatus(eq("merchant@test.com"), eq(1), any()))
                .thenReturn(response);

        mockMvc.perform(put("/orders/1/status")
                        .principal(() -> "merchant@test.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }

    // ── GET /orders/store/{storeId} (merchant) ────────────────────────────────

    @Test
    @DisplayName("GET /orders/store/{storeId} → 200 with store orders")
    void getStoreOrders_merchantRole_returns200() throws Exception {
        when(orderService.getStoreOrders("merchant@test.com", 1))
                .thenReturn(List.of(buildSummary()));

        mockMvc.perform(get("/orders/store/1")
                        .principal(() -> "merchant@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }
}

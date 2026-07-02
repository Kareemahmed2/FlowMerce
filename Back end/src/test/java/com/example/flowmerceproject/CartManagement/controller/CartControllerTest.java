package com.example.flowmerceproject.CartManagement.controller;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.service.CartService;
import com.example.flowmerceproject.CartManagement.service.CheckoutService;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
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
import java.security.Principal;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CartController Slice Tests (standaloneSetup)")
class CartControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private CartService cartService;

    @Mock
    private CheckoutService checkoutService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new CartController(cartService, checkoutService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private CartDTOs.CartResponse emptyCart() {
        return CartDTOs.CartResponse.builder()
                .cartId(1)
                .storeId(1)
                .items(Collections.emptyList())
                .subtotal(BigDecimal.ZERO)
                .build();
    }

    // ── Happy path — GET cart ─────────────────────────────────────────────────

    @Test
    @DisplayName("GET /cart/{storeId} → 200 with cart data")
    void getCart_validRequest_returns200() throws Exception {
        when(cartService.getMyCart(anyString(), eq(1))).thenReturn(emptyCart());

        mockMvc.perform(get("/cart/1")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.cartId").value(1));
    }

    // ── Add item happy path ───────────────────────────────────────────────────

    @Test
    @DisplayName("POST /cart/items → 200 with cart data")
    void addItem_validRequest_returns200() throws Exception {
        CartDTOs.AddToCartRequest request = new CartDTOs.AddToCartRequest();
        request.setProductId(1);
        request.setQuantity(2);

        when(cartService.addItem(anyString(), any(CartDTOs.AddToCartRequest.class)))
                .thenReturn(emptyCart());

        mockMvc.perform(post("/cart/items")
                        .principal(() -> "buyer@test.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── Not found — non-existent cart item returns 404 ────────────────────────

    @Test
    @DisplayName("DELETE /cart/items/{id} for non-existent item → 404")
    void removeItem_notFound_returns404() throws Exception {
        when(cartService.removeItem(anyString(), eq(999)))
                .thenThrow(new ResourceNotFoundException("Cart item not found: 999"));

        mockMvc.perform(delete("/cart/items/999")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isNotFound());
    }

    // ── Bad request — inactive product ────────────────────────────────────────

    @Test
    @DisplayName("POST /cart/items with inactive product → 400")
    void addItem_inactiveProduct_returns400() throws Exception {
        CartDTOs.AddToCartRequest request = new CartDTOs.AddToCartRequest();
        request.setProductId(1);
        request.setQuantity(1);

        when(cartService.addItem(anyString(), any()))
                .thenThrow(new BadRequestException("Product is not available"));

        mockMvc.perform(post("/cart/items")
                        .principal(() -> "buyer@test.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── Update quantity ───────────────────────────────────────────────────────

    @Test
    @DisplayName("PUT /cart/items/{id} → 200 with updated cart")
    void updateQuantity_validRequest_returns200() throws Exception {
        CartDTOs.UpdateQuantityRequest request = new CartDTOs.UpdateQuantityRequest();
        request.setQuantity(3);

        when(cartService.updateItemQuantity(anyString(), eq(1), any()))
                .thenReturn(emptyCart());

        mockMvc.perform(put("/cart/items/1")
                        .principal(() -> "buyer@test.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── Clear cart ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("DELETE /cart/{storeId} → 200 with cleared message")
    void clearCart_validRequest_returns200() throws Exception {
        when(cartService.clearCart(anyString(), eq(1))).thenReturn("Cart cleared successfully.");

        mockMvc.perform(delete("/cart/1")
                        .principal(() -> "buyer@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── Content-Type guard — non-JSON returns 415 ─────────────────────────────

    @Test
    @DisplayName("POST /cart/items with text/plain → 415")
    void addItem_wrongContentType_returns415() throws Exception {
        mockMvc.perform(post("/cart/items")
                        .principal(() -> "buyer@test.com")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("productId=1"))
                .andExpect(status().isUnsupportedMediaType());
    }
}

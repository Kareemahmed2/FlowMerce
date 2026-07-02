package com.example.flowmerceproject.CartManagement.service;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.entity.CartItem;
import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import com.example.flowmerceproject.CartManagement.repository.CartItemRepository;
import com.example.flowmerceproject.CartManagement.repository.ShoppingCartRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("CartService Unit Tests")
class CartServiceTest {

    @Mock private ShoppingCartRepository cartRepository;
    @Mock private CartItemRepository cartItemRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private InventoryService inventoryService;

    @InjectMocks
    private CartService cartService;

    private User user;
    private Customer customer;
    private Merchant merchant;
    private Store store1;
    private Store store2;
    private Product product1;
    private Product product2InStore2;
    private ShoppingCart cart;

    @BeforeEach
    void setUp() {
        user = User.builder().userId(1).email("buyer@test.com").build();
        customer = Customer.builder().customerId(1).user(user).build();

        User merchantUser = User.builder().userId(2).email("merchant@test.com").build();
        merchant = Merchant.builder().merchantId(1).user(merchantUser).build();

        store1 = Store.builder().storeId(1).storeName("Store 1").merchant(merchant).build();
        store2 = Store.builder().storeId(2).storeName("Store 2").merchant(merchant).build();

        product1 = Product.builder()
                .productId(1)
                .name("Product 1")
                .basePrice(new BigDecimal("50.00"))
                .store(store1)
                .isActive(true)
                .build();

        product2InStore2 = Product.builder()
                .productId(2)
                .name("Product 2")
                .basePrice(new BigDecimal("75.00"))
                .store(store2)
                .isActive(true)
                .build();

        cart = ShoppingCart.builder()
                .cartId(1)
                .customer(customer)
                .store(store1)
                .items(new ArrayList<>())
                .build();
    }

    // ── U-CART-01: Add item with available stock ──────────────────────────────

    @Test
    @DisplayName("U-CART-01: addItem - sufficient stock creates cart item")
    void addItem_sufficientStock_createsCartItem() {
        CartDTOs.AddToCartRequest request = new CartDTOs.AddToCartRequest();
        request.setProductId(1);
        request.setQuantity(2);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(productRepository.findById(1)).thenReturn(Optional.of(product1));
        when(cartRepository.findByCustomer_CustomerIdAndStore_StoreId(1, 1))
                .thenReturn(Optional.of(cart));
        doNothing().when(cartRepository).flush();
        when(inventoryService.checkAvailability(1L, 2)).thenReturn(true);
        when(cartItemRepository.findByCart_CartIdAndProduct_ProductId(1, 1))
                .thenReturn(Optional.empty());
        when(cartItemRepository.save(any(CartItem.class))).thenAnswer(i -> {
            CartItem item = i.getArgument(0);
            cart.getItems().add(item);
            return item;
        });
        when(cartRepository.findWithItemsById(1)).thenReturn(Optional.of(cart));

        // Should not throw
        cartService.addItem("buyer@test.com", request);

        verify(cartItemRepository).save(any(CartItem.class));
    }

    // ── U-CART-02: Add item exceeding stock ───────────────────────────────────

    @Test
    @DisplayName("U-CART-02: addItem - exceeds available stock throws BadRequestException")
    void addItem_exceedsStock_throwsBadRequestException() {
        CartDTOs.AddToCartRequest request = new CartDTOs.AddToCartRequest();
        request.setProductId(1);
        request.setQuantity(100);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(productRepository.findById(1)).thenReturn(Optional.of(product1));
        when(cartRepository.findByCustomer_CustomerIdAndStore_StoreId(1, 1))
                .thenReturn(Optional.of(cart));
        doNothing().when(cartRepository).flush();
        when(inventoryService.checkAvailability(1L, 100)).thenReturn(false);
        when(inventoryService.getAvailableQuantity(1L)).thenReturn(5);

        assertThatThrownBy(() -> cartService.addItem("buyer@test.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Not enough stock");
    }

    // ── U-CART-03: Inactive product cannot be added ───────────────────────────

    @Test
    @DisplayName("U-CART-03: addItem - inactive product throws BadRequestException")
    void addItem_inactiveProduct_throwsBadRequestException() {
        product1.setIsActive(false);
        CartDTOs.AddToCartRequest request = new CartDTOs.AddToCartRequest();
        request.setProductId(1);
        request.setQuantity(1);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(productRepository.findById(1)).thenReturn(Optional.of(product1));

        assertThatThrownBy(() -> cartService.addItem("buyer@test.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not available");
    }

    // ── U-CART-04: Update quantity to valid value ─────────────────────────────

    @Test
    @DisplayName("U-CART-04: updateItemQuantity - valid qty updates cart item")
    void updateItemQuantity_validQty_updatesItem() {
        CartItem item = CartItem.builder()
                .cartItemId(1)
                .cart(cart)
                .product(product1)
                .quantity(1)
                .priceAtAdd(new BigDecimal("50.00"))
                .build();

        CartDTOs.UpdateQuantityRequest request = new CartDTOs.UpdateQuantityRequest();
        request.setQuantity(3);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(cartItemRepository.findById(1)).thenReturn(Optional.of(item));
        when(inventoryService.checkAvailability(1L, 3)).thenReturn(true);
        when(cartItemRepository.save(any(CartItem.class))).thenAnswer(i -> i.getArgument(0));
        when(cartRepository.findWithItemsById(1)).thenReturn(Optional.of(cart));

        cartService.updateItemQuantity("buyer@test.com", 1, request);

        verify(cartItemRepository).save(argThat(i -> i.getQuantity() == 3));
    }

    // ── U-CART-05: Remove item deletes it from cart ───────────────────────────

    @Test
    @DisplayName("U-CART-05: removeItem - removes item from cart")
    void removeItem_ownedItem_deletesItem() {
        CartItem item = CartItem.builder()
                .cartItemId(1)
                .cart(cart)
                .product(product1)
                .quantity(1)
                .build();

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(cartItemRepository.findById(1)).thenReturn(Optional.of(item));
        when(cartRepository.findWithItemsById(1)).thenReturn(Optional.of(cart));

        cartService.removeItem("buyer@test.com", 1);

        verify(cartItemRepository).delete(item);
    }

    // ── U-CART-06: Remove item not belonging to customer throws ───────────────

    @Test
    @DisplayName("U-CART-06: removeItem - item not in own cart throws BadRequestException")
    void removeItem_itemNotOwnedByCustomer_throwsBadRequestException() {
        Customer anotherCustomer = Customer.builder().customerId(99).user(user).build();
        ShoppingCart anotherCart = ShoppingCart.builder()
                .cartId(99)
                .customer(anotherCustomer)
                .store(store1)
                .items(new ArrayList<>())
                .build();
        CartItem item = CartItem.builder()
                .cartItemId(1)
                .cart(anotherCart)
                .product(product1)
                .quantity(1)
                .build();

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(cartItemRepository.findById(1)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> cartService.removeItem("buyer@test.com", 1))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("does not belong to your cart");
    }

    // ── U-CART-07: clearCart removes all items ────────────────────────────────

    @Test
    @DisplayName("U-CART-07: clearCart - removes all items from store cart")
    void clearCart_existingCart_clearsItems() {
        CartItem item = CartItem.builder()
                .cartItemId(1)
                .cart(cart)
                .product(product1)
                .quantity(2)
                .build();
        cart.getItems().add(item);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(cartRepository.findByCustomer_CustomerIdAndStore_StoreId(1, 1))
                .thenReturn(Optional.of(cart));
        when(cartRepository.save(any(ShoppingCart.class))).thenReturn(cart);

        String result = cartService.clearCart("buyer@test.com", 1);

        assertThat(result).contains("cleared");
        assertThat(cart.getItems()).isEmpty();
    }

    // ── U-CART-08: calculateSubtotal — correct total ──────────────────────────

    @Test
    @DisplayName("U-CART-08: calculateSubtotal - computes subtotal correctly")
    void calculateSubtotal_multipleItems_returnsCorrectTotal() {
        CartItem item1 = CartItem.builder()
                .product(product1)
                .quantity(2)
                .priceAtAdd(new BigDecimal("50.00"))
                .build();
        CartItem item2 = CartItem.builder()
                .product(product2InStore2)
                .quantity(1)
                .priceAtAdd(new BigDecimal("75.00"))
                .build();
        cart.getItems().addAll(java.util.List.of(item1, item2));

        BigDecimal subtotal = cartService.calculateSubtotal(cart);

        // 2×50 + 1×75 = 175
        assertThat(subtotal).isEqualByComparingTo(new BigDecimal("175.00"));
    }

    // ── U-CART-09: addItem - product not found throws ResourceNotFoundException

    @Test
    @DisplayName("U-CART-09: addItem - non-existent product throws ResourceNotFoundException")
    void addItem_productNotFound_throwsResourceNotFoundException() {
        CartDTOs.AddToCartRequest request = new CartDTOs.AddToCartRequest();
        request.setProductId(999);
        request.setQuantity(1);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user));
        when(customerRepository.findByUser_UserId(1)).thenReturn(Optional.of(customer));
        when(productRepository.findById(999)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cartService.addItem("buyer@test.com", request))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}

package com.example.flowmerceproject.CartManagement.service;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.entity.CartItem;
import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import com.example.flowmerceproject.CartManagement.repository.CartItemRepository;
import com.example.flowmerceproject.CartManagement.repository.ShoppingCartRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.entity.ProductMedia;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartService {

    private final ShoppingCartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final InventoryService inventoryService;

    // GET OR CREATE CART
    // Every customer has exactly one cart
    @Transactional
    public CartDTOs.CartResponse getMyCart(String email) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);
        return toResponse(cart);
    }

    // ADD ITEM TO CART
    // If product already in cart → increase quantity
    // If new product → add as new item
    @Transactional
    public CartDTOs.CartResponse addItem(String email, CartDTOs.AddToCartRequest request) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + request.getProductId()));

        if (!product.getIsActive()) {
            throw new BadRequestException("Product is not available: " + product.getName());
        }

        // Check stock availability via InventoryService (Redis → DB)
        boolean available = inventoryService.checkAvailability(
                product.getProductId().longValue(), request.getQuantity());
        if (!available) {
            throw new BadRequestException(
                    "Not enough stock for: " + product.getName() +
                            ". Available: " + inventoryService.getAvailableQuantity(
                            product.getProductId().longValue()));
        }

        // If product already in cart — update quantity
        var existingItem = cartItemRepository.findByCart_CartIdAndProduct_ProductId(
                cart.getCartId(), product.getProductId());

        if (existingItem.isPresent()) {
            CartItem item = existingItem.get();
            int newQty = item.getQuantity() + request.getQuantity();

            // Re-check availability for total quantity
            if (!inventoryService.checkAvailability(
                    product.getProductId().longValue(), newQty)) {
                throw new BadRequestException(
                        "Cannot add " + request.getQuantity() + " more. " +
                                "Available stock: " + inventoryService.getAvailableQuantity(
                                product.getProductId().longValue()));
            }

            item.setQuantity(newQty);
            cartItemRepository.save(item);
            log.info("Cart item quantity updated: product={}, newQty={}", product.getName(), newQty);
        } else {
            // New item — snapshot the current price
            CartItem newItem = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .quantity(request.getQuantity())
                    .priceAtAdd(product.getBasePrice()) // price locked at add time to avoid change in prices
                    .build();
            cartItemRepository.save(newItem);
            log.info("Item added to cart: product={}, qty={}", product.getName(), request.getQuantity());
        }

        // Refresh and return cart
        cart = cartRepository.findById(cart.getCartId()).orElseThrow();
        return toResponse(cart);
    }

    // UPDATE ITEM QUANTITY
    @Transactional
    public CartDTOs.CartResponse updateItemQuantity(String email, Integer cartItemId,
                                                    CartDTOs.UpdateQuantityRequest request) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);

        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cart item not found: " + cartItemId));

        // Make sure item belongs to this customer's cart
        if (!item.getCart().getCartId().equals(cart.getCartId())) {
            throw new BadRequestException("This item does not belong to your cart.");
        }

        // Check stock for new quantity
        boolean available = inventoryService.checkAvailability(
                item.getProduct().getProductId().longValue(), request.getQuantity());
        if (!available) {
            throw new BadRequestException(
                    "Requested quantity exceeds available stock. Available: "
                            + inventoryService.getAvailableQuantity(
                            item.getProduct().getProductId().longValue()));
        }

        item.setQuantity(request.getQuantity());
        cartItemRepository.save(item);

        cart = cartRepository.findById(cart.getCartId()).orElseThrow();
        return toResponse(cart);
    }

    // REMOVE ITEM FROM CART
    @Transactional
    public CartDTOs.CartResponse removeItem(String email, Integer cartItemId) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);

        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cart item not found: " + cartItemId));

        if (!item.getCart().getCartId().equals(cart.getCartId())) {
            throw new BadRequestException("This item does not belong to your cart.");
        }

        cartItemRepository.delete(item);
        log.info("Item removed from cart: cartItemId={}", cartItemId);

        cart = cartRepository.findById(cart.getCartId()).orElseThrow();
        return toResponse(cart);
    }

    // CLEAR CART — removes all items
    @Transactional
    public String clearCart(String email) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);
        cart.getItems().clear();
        cartRepository.save(cart);
        log.info("Cart cleared for customer={}", customer.getCustomerId());
        return "Cart cleared successfully.";
    }

    // CALCULATE TOTALS — used internally and by checkout
    public BigDecimal calculateSubtotal(ShoppingCart cart) {
        return cart.getItems().stream()
                .map(item -> item.getPriceAtAdd()
                        .multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // HELPERS
    private Customer getCustomerByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException(
                        "Only customers can access the cart."));
    }

    public ShoppingCart getOrCreateCart(Customer customer) {
        return cartRepository.findByCustomer_CustomerId(customer.getCustomerId())
                .orElseGet(() -> {
                    ShoppingCart newCart = ShoppingCart.builder()
                            .customer(customer)
                            .expiresAt(LocalDateTime.now().plusDays(7))
                            .build();
                    cartRepository.save(newCart);
                    log.info("New cart created for customer={}", customer.getCustomerId());
                    return newCart;
                });
    }

    public CartDTOs.CartResponse toResponse(ShoppingCart cart) {
        List<CartDTOs.CartItemResponse> itemResponses = cart.getItems().stream()
                .map(item -> {
                    int availableStock = 0;
                    try {
                        availableStock = inventoryService.getAvailableQuantity(
                                item.getProduct().getProductId().longValue());
                    } catch (Exception ignored) {}

                    // Get first image from product media
                    String imageUrl = null;
                    if (item.getProduct().getMediaList() != null
                            && !item.getProduct().getMediaList().isEmpty()) {
                        imageUrl = item.getProduct().getMediaList()
                                .stream()
                                .filter(m -> "IMAGE".equals(m.getMediaType()))
                                .map(ProductMedia::getMediaUrl)
                                .findFirst()
                                .orElse(null);
                    }

                    BigDecimal subtotal = item.getPriceAtAdd()
                            .multiply(BigDecimal.valueOf(item.getQuantity()));

                    return CartDTOs.CartItemResponse.builder()
                            .cartItemId(item.getCartItemId())
                            .productId(item.getProduct().getProductId())
                            .productName(item.getProduct().getName())
                            .productImage(imageUrl)
                            .quantity(item.getQuantity())
                            .priceAtAdd(item.getPriceAtAdd())
                            .subtotal(subtotal)
                            .availableStock(availableStock)
                            .addedAt(item.getAddedAt())
                            .build();
                })
                .collect(Collectors.toList());

        BigDecimal subtotal = calculateSubtotal(cart);

        return CartDTOs.CartResponse.builder()
                .cartId(cart.getCartId())
                .customerId(cart.getCustomer().getCustomerId())
                .items(itemResponses)
                .totalItems(itemResponses.stream()
                        .mapToInt(CartDTOs.CartItemResponse::getQuantity).sum())
                .subtotal(subtotal)
                .createdAt(cart.getCreatedAt())
                .expiresAt(cart.getExpiresAt())
                .build();
    }
}
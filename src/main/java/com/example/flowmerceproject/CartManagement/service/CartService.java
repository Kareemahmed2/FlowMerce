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

    @Transactional
    public CartDTOs.CartResponse getMyCart(String email) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);
        return toResponse(cart);
    }

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

        boolean available = inventoryService.checkAvailability(
                product.getProductId().longValue(), request.getQuantity());
        if (!available) {
            throw new BadRequestException(
                    "Not enough stock for: " + product.getName() +
                            ". Available: " + inventoryService.getAvailableQuantity(
                            product.getProductId().longValue()));
        }

        var existingItem = cartItemRepository.findByCart_CartIdAndProduct_ProductId(
                cart.getCartId(), product.getProductId());

        if (existingItem.isPresent()) {
            CartItem item = existingItem.get();
            int newQty = item.getQuantity() + request.getQuantity();

            if (!inventoryService.checkAvailability(
                    product.getProductId().longValue(), newQty)) {
                throw new BadRequestException(
                        "Cannot add " + request.getQuantity() + " more. Available: "
                                + inventoryService.getAvailableQuantity(
                                product.getProductId().longValue()));
            }

            item.setQuantity(newQty);
            cartItemRepository.save(item);
        } else {
            CartItem newItem = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .quantity(request.getQuantity())
                    .priceAtAdd(product.getBasePrice())
                    .build();
            cartItemRepository.save(newItem);
        }

        cart = cartRepository.findById(cart.getCartId()).orElseThrow();
        return toResponse(cart);
    }

    @Transactional
    public CartDTOs.CartResponse updateItemQuantity(String email, Integer cartItemId,
                                                    CartDTOs.UpdateQuantityRequest request) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);

        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cart item not found: " + cartItemId));

        if (!item.getCart().getCartId().equals(cart.getCartId())) {
            throw new BadRequestException("This item does not belong to your cart.");
        }

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

        cart = cartRepository.findById(cart.getCartId()).orElseThrow();
        return toResponse(cart);
    }

    @Transactional
    public String clearCart(String email) {
        Customer customer = getCustomerByEmail(email);
        ShoppingCart cart = getOrCreateCart(customer);
        cart.getItems().clear();
        cartRepository.save(cart);
        return "Cart cleared successfully.";
    }

    public BigDecimal calculateSubtotal(ShoppingCart cart) {
        return cart.getItems().stream()
                .map(item -> item.getPriceAtAdd()
                        .multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

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
                    return cartRepository.save(newCart);
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

                    String imageUrl = null;
                    if (item.getProduct().getMediaList() != null
                            && !item.getProduct().getMediaList().isEmpty()) {
                        imageUrl = item.getProduct().getMediaList().stream()
                                .filter(m -> "IMAGE".equals(m.getMediaType()))
                                .map(ProductMedia::getMediaUrl)
                                .findFirst().orElse(null);
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

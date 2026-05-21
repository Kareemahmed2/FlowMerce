package com.example.flowmerceproject.CartManagement.service;

import com.example.flowmerceproject.CartManagement.dto.CartDTOs;
import com.example.flowmerceproject.CartManagement.dto.WishlistDTOs;
import com.example.flowmerceproject.CartManagement.entity.Wishlist;
import com.example.flowmerceproject.CartManagement.repository.WishlistRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.entity.ProductMedia;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final InventoryService inventoryService;
    private final CartService cartService;

    public WishlistDTOs.WishlistResponse getMyWishlist(String email) {
        Customer customer = findCustomerByEmail(email);
        List<Wishlist> items = wishlistRepository.findByCustomer_CustomerId(customer.getCustomerId());
        return toResponse(customer.getCustomerId(), items);
    }

    @Transactional
    public WishlistDTOs.WishlistResponse addToWishlist(String email,
                                                       WishlistDTOs.AddToWishlistRequest request) {
        Customer customer = findCustomerByEmail(email);
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + request.getProductId()));

        if (wishlistRepository.existsByCustomer_CustomerIdAndProduct_ProductId(
                customer.getCustomerId(), product.getProductId())) {
            throw new ConflictException("Product already in your wishlist.");
        }

        wishlistRepository.save(Wishlist.builder().customer(customer).product(product).build());
        return getMyWishlist(email);
    }

    @Transactional
    public WishlistDTOs.WishlistResponse removeFromWishlist(String email, Integer productId) {
        Customer customer = findCustomerByEmail(email);

        if (!wishlistRepository.existsByCustomer_CustomerIdAndProduct_ProductId(
                customer.getCustomerId(), productId)) {
            throw new ResourceNotFoundException("Product not found in your wishlist.");
        }

        wishlistRepository.deleteByCustomer_CustomerIdAndProduct_ProductId(
                customer.getCustomerId(), productId);
        return getMyWishlist(email);
    }

    @Transactional
    public CartDTOs.CartResponse moveToCart(String email, Integer productId) {
        Customer customer = findCustomerByEmail(email);

        if (!wishlistRepository.existsByCustomer_CustomerIdAndProduct_ProductId(
                customer.getCustomerId(), productId)) {
            throw new ResourceNotFoundException("Product not found in your wishlist.");
        }

        CartDTOs.AddToCartRequest cartRequest = new CartDTOs.AddToCartRequest();
        cartRequest.setProductId(productId);
        cartRequest.setQuantity(1);

        CartDTOs.CartResponse cartResponse = cartService.addItem(email, cartRequest);
        wishlistRepository.deleteByCustomer_CustomerIdAndProduct_ProductId(
                customer.getCustomerId(), productId);
        return cartResponse;
    }

    private Customer findCustomerByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can use the wishlist."));
    }

    private WishlistDTOs.WishlistResponse toResponse(Integer customerId, List<Wishlist> items) {
        List<WishlistDTOs.WishlistItemResponse> itemResponses = items.stream()
                .map(w -> {
                    Product p = w.getProduct();

                    int stock = 0;
                    try {
                        stock = inventoryService.getAvailableQuantity(
                                p.getProductId().longValue());
                    } catch (Exception ignored) {}

                    String imageUrl = null;
                    if (p.getMediaList() != null && !p.getMediaList().isEmpty()) {
                        imageUrl = p.getMediaList().stream()
                                .filter(m -> "IMAGE".equals(m.getMediaType()))
                                .map(ProductMedia::getMediaUrl)
                                .findFirst().orElse(null);
                    }

                    return WishlistDTOs.WishlistItemResponse.builder()
                            .wishlistId(w.getWishlistId())
                            .productId(p.getProductId())
                            .productName(p.getName())
                            .productImage(imageUrl)
                            .basePrice(p.getBasePrice())
                            .availableStock(stock)
                            .isActive(p.getIsActive())
                            .addedAt(w.getCreatedAt())
                            .build();
                })
                .collect(Collectors.toList());

        return WishlistDTOs.WishlistResponse.builder()
                .userId(customerId)
                .items(itemResponses)
                .totalItems(itemResponses.size())
                .build();
    }
}

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

    // GET MY WISHLIST
    public WishlistDTOs.WishlistResponse getMyWishlist(String email) {
        User user = findUserByEmail(email);
        List<Wishlist> items = wishlistRepository.findByUser_UserId(user.getUserId());
        return toResponse(user.getUserId(), items);
    }

    // ADD TO WISHLIST
    @Transactional
    public WishlistDTOs.WishlistResponse addToWishlist(String email,
                                                       WishlistDTOs.AddToWishlistRequest request) {
        User user = findUserByEmail(email);
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + request.getProductId()));

        if (wishlistRepository.existsByUser_UserIdAndProduct_ProductId(
                user.getUserId(), product.getProductId())) {
            throw new ConflictException("Product already in your wishlist.");
        }

        Wishlist wishlist = Wishlist.builder()
                .user(user)
                .product(product)
                .build();

        wishlistRepository.save(wishlist);
        log.info("Product added to wishlist: userId={}, productId={}",
                user.getUserId(), product.getProductId());

        return getMyWishlist(email);
    }

    // REMOVE FROM WISHLIST
    @Transactional
    public WishlistDTOs.WishlistResponse removeFromWishlist(String email, Integer productId) {
        User user = findUserByEmail(email);

        if (!wishlistRepository.existsByUser_UserIdAndProduct_ProductId(
                user.getUserId(), productId)) {
            throw new ResourceNotFoundException("Product not found in your wishlist.");
        }

        wishlistRepository.deleteByUser_UserIdAndProduct_ProductId(
                user.getUserId(), productId);

        log.info("Product removed from wishlist: userId={}, productId={}",
                user.getUserId(), productId);

        return getMyWishlist(email);
    }

    // MOVE TO CART
    // Removes from wishlist and adds to cart
    @Transactional
    public CartDTOs.CartResponse moveToCart(String email, Integer productId) {
        User user = findUserByEmail(email);

        // Verify item is in wishlist
        if (!wishlistRepository.existsByUser_UserIdAndProduct_ProductId(
                user.getUserId(), productId)) {
            throw new ResourceNotFoundException("Product not found in your wishlist.");
        }

        // Add to cart with quantity 1
        CartDTOs.AddToCartRequest cartRequest = new CartDTOs.AddToCartRequest();
        cartRequest.setProductId(productId);
        cartRequest.setQuantity(1);

        CartDTOs.CartResponse cartResponse = cartService.addItem(email, cartRequest);

        // Remove from wishlist after adding to cart
        wishlistRepository.deleteByUser_UserIdAndProduct_ProductId(
                user.getUserId(), productId);

        log.info("Product moved from wishlist to cart: userId={}, productId={}",
                user.getUserId(), productId);

        return cartResponse;
    }

    // HELPERS
    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private WishlistDTOs.WishlistResponse toResponse(Integer userId, List<Wishlist> items) {
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
                .userId(userId)
                .items(itemResponses)
                .totalItems(itemResponses.size())
                .build();
    }
}
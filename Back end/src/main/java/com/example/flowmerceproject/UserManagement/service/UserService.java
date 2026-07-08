package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.CartManagement.repository.ShoppingCartRepository;
import com.example.flowmerceproject.CartManagement.repository.WishlistRepository;
import com.example.flowmerceproject.NotificationManagement.repository.NotificationRepository;
import com.example.flowmerceproject.ProductManagement.repository.ReviewRepository;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.dto.ChangePasswordRequest;
import com.example.flowmerceproject.UserManagement.dto.UpdateProfileRequest;
import com.example.flowmerceproject.UserManagement.dto.UserResponse;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.exception.UnauthorizedException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import com.example.flowmerceproject.UserManagement.repository.UserProfileRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.entity.Wallet;
import com.example.flowmerceproject.PaymentManagement.repository.PaymentRepository;
import com.example.flowmerceproject.PaymentManagement.repository.WalletRepository;
import com.example.flowmerceproject.PaymentManagement.repository.WalletTransactionRepository;
import com.example.flowmerceproject.ShippingManagement.repository.ShipmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final SessionCacheService sessionCacheService;
    private final PasswordEncoder passwordEncoder;
    private final MerchantRepository merchantRepository;
    private final CustomerRepository customerRepository;
    private final UserProfileRepository userProfileRepository;
    private final NotificationRepository notificationRepository;
    private final StoreRepository storeRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final ShipmentRepository shipmentRepository;
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final ShoppingCartRepository shoppingCartRepository;
    private final WishlistRepository wishlistRepository;
    private final ReviewRepository reviewRepository;

    public UserResponse getMyProfile(String email) {
        return toResponse(findByEmailOrThrow(email));
    }

    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = findByEmailOrThrow(email);
        user.setFullName(request.getFullName());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public String changePassword(String email, ChangePasswordRequest request) {

        User user = findByEmailOrThrow(email);

        //Check current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Current password is incorrect");
        }

        //Check new password matches confirm password
        if (!request.getNewPassword().equals(request.getConfirmNewPassword())) {
            throw new BadRequestException("New password and confirm password do not match");
        }

        //Prevent using same old password
        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password must be different from current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // revoke all sessions after password change
        sessionCacheService.evictAllForUser(user.getUserId());
        sessionRepository.revokeAllByUserId(user.getUserId());

        return "Password changed successfully. Please log in again.";
    }

    @Transactional
    public String deleteMyAccount(String email) {
        User user = findByEmailOrThrow(email);
        deleteUserById(user.getUserId());
        return "Account deleted successfully.";
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public UserResponse activateUser(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        user.setIsActive(true);
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public String deleteUserById(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        // Delete in dependency order to avoid FK constraint violations.
        // 1. Sessions (auth tokens)
        sessionCacheService.evictAllForUser(userId);
        sessionRepository.revokeAllByUserId(userId);
        sessionRepository.deleteByUser_UserId(userId);

        // 2. Notifications
        notificationRepository.deleteByUser_UserId(userId);

        // 3. User profile
        userProfileRepository.findByUser_UserId(userId)
                .ifPresent(userProfileRepository::delete);

        // 4. Customer profile: delete reviews, wishlist entries and shopping carts
        //    (Hibernate's ddl-auto=update generates these FKs as NO ACTION, not the
        //    ON DELETE CASCADE that schema.sql declares, since schema.sql never runs
        //    against the live DB - so these must be deleted explicitly), then wallet
        //    transactions + wallet (if any), then the customer's orders' dependents
        //    (shipments, payments) then the orders themselves, then the customer row.
        customerRepository.findByUser_UserId(userId).ifPresent(customer -> {
            reviewRepository.deleteAll(reviewRepository.findByCustomer_CustomerId(customer.getCustomerId()));
            wishlistRepository.deleteAll(wishlistRepository.findByCustomer_CustomerId(customer.getCustomerId()));
            shoppingCartRepository.deleteAll(shoppingCartRepository.findByCustomer_CustomerId(customer.getCustomerId()));
            deleteWalletAndTransactions(walletRepository.findByCustomer_CustomerId(customer.getCustomerId()));
            orderRepository.findByCustomer_CustomerIdOrderByOrderDateDesc(customer.getCustomerId())
                    .forEach(this::deleteOrderDependentsThenOrder);
            customerRepository.delete(customer);
        });

        // 5. Merchant: for each store, delete its orders' dependents (shipments,
        //    payments) then the orders, then the store itself (no DB-level cascade
        //    from merchants→stores; store deletion already cascades
        //    products/categories/inventory/storefront rows via DB/JPA cascade), then
        //    the merchant's wallet + wallet transactions (if any), then finally the
        //    merchant profile row itself.
        merchantRepository.findByUser_UserId(userId).ifPresent(merchant -> {
            storeRepository.findByMerchant_MerchantId(merchant.getMerchantId()).forEach(store -> {
                orderRepository.findByStore_StoreIdOrderByOrderDateDesc(store.getStoreId())
                        .forEach(this::deleteOrderDependentsThenOrder);
                storeRepository.delete(store);
            });
            deleteWalletAndTransactions(walletRepository.findByMerchant_MerchantId(merchant.getMerchantId()));
            merchantRepository.delete(merchant);
        });

        // 6. Finally the user row itself
        userRepository.delete(user);
        return "User deleted successfully.";
    }

    /**
     * Deletes an order's dependents (shipment, then payment) in FK-safe order, then
     * the order itself (order_items and the order's invoice cascade automatically
     * via JPA's CascadeType.ALL on Order.items / Order.invoice).
     */
    private void deleteOrderDependentsThenOrder(Order order) {
        shipmentRepository.findByOrder_OrderId(order.getOrderId()).ifPresent(shipmentRepository::delete);
        paymentRepository.findByOrder_OrderId(order.getOrderId()).ifPresent(paymentRepository::delete);
        orderRepository.delete(order);
    }

    /** Deletes a wallet's transactions, then the wallet itself, if the wallet is present. */
    private void deleteWalletAndTransactions(Optional<Wallet> walletOpt) {
        walletOpt.ifPresent(wallet -> {
            walletTransactionRepository.findByWallet_WalletIdOrderByCreatedAtDesc(wallet.getWalletId())
                    .forEach(walletTransactionRepository::delete);
            walletRepository.delete(wallet);
        });
    }

    @Transactional
    public UserResponse setMfaEnabled(String email, boolean enabled) {
        User user = findByEmailOrThrow(email);
        user.setIsMfaEnabled(enabled);
        userRepository.save(user);
        return toResponse(user);
    }

    private User findByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
    }

    public UserResponse toResponse(User user) {
        return UserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .isMfaEnabled(user.getIsMfaEnabled())
                .build();
    }
}
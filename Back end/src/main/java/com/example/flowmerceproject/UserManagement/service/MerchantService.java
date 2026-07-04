package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.UserManagement.dto.MerchantDTOs;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.Role;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.example.flowmerceproject.UserManagement.repository.UserProfileRepository;
import com.example.flowmerceproject.NotificationManagement.repository.NotificationRepository;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.repository.PaymentRepository;
import com.example.flowmerceproject.PaymentManagement.repository.WalletRepository;
import com.example.flowmerceproject.PaymentManagement.repository.WalletTransactionRepository;
import com.example.flowmerceproject.ShippingManagement.repository.ShipmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MerchantService {

    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final SessionCacheService sessionCacheService;
    private final StoreRepository storeRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final ShipmentRepository shipmentRepository;
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final UserProfileRepository userProfileRepository;
    private final NotificationRepository notificationRepository;

    @Transactional
    public MerchantDTOs.MerchantResponse createMerchantProfile(String email, MerchantDTOs.MerchantRequest request) {
        User user = findUserOrThrow(email);
        if (merchantRepository.existsByUser_UserId(user.getUserId())) {
            throw new ConflictException("Merchant profile already exists for this user");
        }
        user.setRole(Role.MERCHANT);
        userRepository.save(user);
        sessionCacheService.evictAllForUser(user.getUserId());
        Merchant merchant = Merchant.builder()
                .user(user).businessName(request.getBusinessName()).isVerified(false).build();
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    @Transactional(readOnly = true)
    public MerchantDTOs.MerchantResponse getMerchantProfile(String email) {
        User user = findUserOrThrow(email);
        Merchant merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Merchant profile not found"));
        return toResponse(merchant);
    }

    @Transactional
    public String deleteMerchantAccount(String email) {
        User user = findUserOrThrow(email);
        Merchant merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Merchant profile not found"));

        // Delete in dependency order to avoid FK constraint violations.
        // 1. Each store's orders' dependents (shipments, payments), then the orders,
        //    then the store itself (no DB-level cascade from merchants→stores; store
        //    deletion already cascades products/categories/inventory/storefront rows
        //    via DB/JPA cascade).
        deleteStoresAndOrderDependents(merchant.getMerchantId());
        // 2. Merchant wallet + wallet transactions, if any.
        deleteMerchantWalletAndTransactions(merchant.getMerchantId());
        // 3. The merchant profile row itself.
        merchantRepository.delete(merchant);

        // 4. Sessions, notifications, and the user profile row (none of these cascade
        //    from the users table at the DB level), then finally the user row itself.
        sessionCacheService.evictAllForUser(user.getUserId());
        sessionRepository.revokeAllByUserId(user.getUserId());
        sessionRepository.deleteByUser_UserId(user.getUserId());
        notificationRepository.deleteByUser_UserId(user.getUserId());
        userProfileRepository.findByUser_UserId(user.getUserId()).ifPresent(userProfileRepository::delete);
        userRepository.delete(user);
        return "Merchant account deleted successfully.";
    }

    @Transactional(readOnly = true)
    public List<MerchantDTOs.MerchantResponse> getAllMerchants() {
        return merchantRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public MerchantDTOs.MerchantResponse verifyMerchant(Integer merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant not found with id: " + merchantId));
        merchant.setIsVerified(true);
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    @Transactional
    public String deleteMerchantById(Integer merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant not found with id: " + merchantId));
        User user = merchant.getUser();

        // Delete in dependency order to avoid FK constraint violations.
        // 1. Each store's orders' dependents (shipments, payments), then the orders,
        //    then the store itself (no DB-level cascade from merchants→stores; store
        //    deletion already cascades products/categories/inventory/storefront rows
        //    via DB/JPA cascade).
        deleteStoresAndOrderDependents(merchant.getMerchantId());
        // 2. Merchant wallet + wallet transactions, if any.
        deleteMerchantWalletAndTransactions(merchant.getMerchantId());
        // 3. The merchant profile row itself.
        merchantRepository.delete(merchant);

        // 4. Sessions, notifications, and the user profile row (none of these cascade
        //    from the users table at the DB level), then finally the user row itself.
        sessionCacheService.evictAllForUser(user.getUserId());
        sessionRepository.revokeAllByUserId(user.getUserId());
        sessionRepository.deleteByUser_UserId(user.getUserId());
        notificationRepository.deleteByUser_UserId(user.getUserId());
        userProfileRepository.findByUser_UserId(user.getUserId()).ifPresent(userProfileRepository::delete);
        userRepository.delete(user);
        return "Merchant deleted successfully.";
    }

    /**
     * For every store owned by this merchant: delete each order's dependents
     * (shipment, then payment) in FK-safe order, then the order itself (order_items
     * and the order's invoice cascade automatically via JPA), then the store itself.
     */
    private void deleteStoresAndOrderDependents(Integer merchantId) {
        storeRepository.findByMerchant_MerchantId(merchantId).forEach(store -> {
            orderRepository.findByStore_StoreIdOrderByOrderDateDesc(store.getStoreId()).forEach(order -> {
                shipmentRepository.findByOrder_OrderId(order.getOrderId()).ifPresent(shipmentRepository::delete);
                paymentRepository.findByOrder_OrderId(order.getOrderId()).ifPresent(paymentRepository::delete);
                orderRepository.delete(order);
            });
            storeRepository.delete(store);
        });
    }

    /** Deletes the merchant's wallet transactions, then the wallet itself, if either exists. */
    private void deleteMerchantWalletAndTransactions(Integer merchantId) {
        walletRepository.findByMerchant_MerchantId(merchantId).ifPresent(wallet -> {
            walletTransactionRepository.findByWallet_WalletIdOrderByCreatedAtDesc(wallet.getWalletId())
                    .forEach(walletTransactionRepository::delete);
            walletRepository.delete(wallet);
        });
    }

    private User findUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
    }

    private MerchantDTOs.MerchantResponse toResponse(Merchant merchant) {
        User user = merchant.getUser();
        return MerchantDTOs.MerchantResponse.builder()
                .merchantId(merchant.getMerchantId())
                .userId(user.getUserId())
                .businessName(merchant.getBusinessName())
                .isVerified(merchant.getIsVerified())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .storeCount(storeRepository.countByMerchant_MerchantId(merchant.getMerchantId()))
                .build();
    }
}
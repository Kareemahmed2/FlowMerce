package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.NotificationManagement.repository.NotificationRepository;
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
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
        sessionCacheService.evictAllForUser(user.getUserId());
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
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

        // 4. Customer profile (stores wishlist/cart cascade from customers table)
        customerRepository.findByUser_UserId(userId)
                .ifPresent(customerRepository::delete);

        // 5. Merchant: delete stores first (no DB-level cascade from merchants→stores),
        //    then the merchant profile row itself.
        merchantRepository.findByUser_UserId(userId).ifPresent(merchant -> {
            storeRepository.findByMerchant_MerchantId(merchant.getMerchantId())
                    .forEach(storeRepository::delete);
            merchantRepository.delete(merchant);
        });

        // 6. Finally the user row itself
        userRepository.delete(user);
        return "User deleted successfully.";
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
                .build();
    }
}
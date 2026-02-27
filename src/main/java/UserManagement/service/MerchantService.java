package UserManagement.service;

import UserManagement.dto.MerchantDTOs;
import UserManagement.entity.Merchant;
import UserManagement.entity.Role;
import UserManagement.entity.User;
import UserManagement.repository.MerchantRepository;
import UserManagement.repository.SessionRepository;
import UserManagement.repository.UserRepository;
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

    // ─────────────────────────────────────────────
    // CREATE MERCHANT PROFILE
    // ─────────────────────────────────────────────
    @Transactional
    public MerchantDTOs.MerchantResponse createMerchantProfile(
            String email, MerchantDTOs.MerchantRequest request) {

        User user = findUserByEmailOrThrow(email);

        if (merchantRepository.existsByUser_UserId(user.getUserId())) {
            throw new RuntimeException("Merchant profile already exists for this user");
        }

        // Upgrade user role to MERCHANT
        user.setRole(Role.MERCHANT);
        userRepository.save(user);

        Merchant merchant = Merchant.builder()
                .user(user)
                .businessName(request.getBusinessName())
                .isVerified(false)
                .build();

        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    // ─────────────────────────────────────────────
    // GET MY MERCHANT PROFILE
    // ─────────────────────────────────────────────
    public MerchantDTOs.MerchantResponse getMerchantProfile(String email) {
        User user = findUserByEmailOrThrow(email);
        Merchant merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Merchant profile not found"));
        return toResponse(merchant);
    }

    // ─────────────────────────────────────────────
    // DELETE MERCHANT ACCOUNT
    // ─────────────────────────────────────────────
    @Transactional
    public String deleteMerchantAccount(String email) {
        User user = findUserByEmailOrThrow(email);
        Merchant merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Merchant profile not found"));

        merchantRepository.delete(merchant);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);

        return "Merchant account deleted successfully.";
    }

    // ─────────────────────────────────────────────
    // ADMIN: LIST ALL MERCHANTS
    // ─────────────────────────────────────────────
    public List<MerchantDTOs.MerchantResponse> getAllMerchants() {
        return merchantRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────
    // ADMIN: VERIFY MERCHANT
    // ─────────────────────────────────────────────
    @Transactional
    public MerchantDTOs.MerchantResponse verifyMerchant(Integer merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new RuntimeException("Merchant not found with id: " + merchantId));
        merchant.setIsVerified(true);
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    // ─────────────────────────────────────────────
    // ADMIN: DELETE ANY MERCHANT
    // ─────────────────────────────────────────────
    @Transactional
    public String deleteMerchantById(Integer merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new RuntimeException("Merchant not found with id: " + merchantId));
        User user = merchant.getUser();
        merchantRepository.delete(merchant);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
        return "Merchant deleted successfully.";
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    private User findUserByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private MerchantDTOs.MerchantResponse toResponse(Merchant merchant) {
        return MerchantDTOs.MerchantResponse.builder()
                .merchantId(merchant.getMerchantId())
                .userId(merchant.getUser().getUserId())
                .businessName(merchant.getBusinessName())
                .isVerified(merchant.getIsVerified())
                .email(merchant.getUser().getEmail())
                .fullName(merchant.getUser().getFullName())
                .build();
    }
}
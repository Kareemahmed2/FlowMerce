package UserManagement.service;

import UserManagement.dto.MerchantDTOs;
import UserManagement.entity.Merchant;
import UserManagement.entity.Role;
import UserManagement.entity.User;
import UserManagement.exception.ConflictException;
import UserManagement.exception.ResourceNotFoundException;
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

    @Transactional
    public MerchantDTOs.MerchantResponse createMerchantProfile(String email, MerchantDTOs.MerchantRequest request) {
        User user = findUserOrThrow(email);
        if (merchantRepository.existsByUser_UserId(user.getUserId())) {
            throw new ConflictException("Merchant profile already exists for this user");
        }
        user.setRole(Role.MERCHANT);
        userRepository.save(user);
        Merchant merchant = Merchant.builder()
                .user(user).businessName(request.getBusinessName()).isVerified(false).build();
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

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
        merchantRepository.delete(merchant);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
        return "Merchant account deleted successfully.";
    }

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
        merchantRepository.delete(merchant);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
        return "Merchant deleted successfully.";
    }

    private User findUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
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
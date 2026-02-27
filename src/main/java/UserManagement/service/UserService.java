package UserManagement.service;

import UserManagement.dto.ChangePasswordRequest;
import UserManagement.dto.UpdateProfileRequest;
import UserManagement.dto.UserResponse;
import UserManagement.entity.User;
import UserManagement.repository.SessionRepository;
import UserManagement.repository.UserRepository;
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
    private final PasswordEncoder passwordEncoder;

    // ─────────────────────────────────────────────
    // GET MY PROFILE
    // ─────────────────────────────────────────────
    public UserResponse getMyProfile(String email) {
        User user = findByEmailOrThrow(email);
        return toResponse(user);
    }

    // ─────────────────────────────────────────────
    // UPDATE MY PROFILE
    // ─────────────────────────────────────────────
    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = findByEmailOrThrow(email);
        user.setFullName(request.getFullName());
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        userRepository.save(user);
        return toResponse(user);
    }

    // ─────────────────────────────────────────────
    // CHANGE PASSWORD
    // ─────────────────────────────────────────────
    @Transactional
    public String changePassword(String email, ChangePasswordRequest request) {
        User user = findByEmailOrThrow(email);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke all sessions so the user must log in again
        sessionRepository.revokeAllByUserId(user.getUserId());

        return "Password changed successfully. Please log in again.";
    }

    // ─────────────────────────────────────────────
    // DELETE MY ACCOUNT
    // ─────────────────────────────────────────────
    @Transactional
    public String deleteMyAccount(String email) {
        User user = findByEmailOrThrow(email);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
        return "Account deleted successfully.";
    }

    // ─────────────────────────────────────────────
    // ADMIN: LIST ALL USERS
    // ─────────────────────────────────────────────
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────
    // ADMIN: DELETE ANY USER
    // ─────────────────────────────────────────────
    @Transactional
    public String deleteUserById(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
        sessionRepository.revokeAllByUserId(userId);
        userRepository.delete(user);
        return "User deleted successfully.";
    }

    // ─────────────────────────────────────────────
    // HELPER METHODS
    // ─────────────────────────────────────────────
    private User findByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public UserResponse toResponse(User user) {
        return UserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
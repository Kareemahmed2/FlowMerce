package UserManagement.service;

import UserManagement.dto.ChangePasswordRequest;
import UserManagement.dto.UpdateProfileRequest;
import UserManagement.dto.UserResponse;
import UserManagement.entity.User;
import UserManagement.exception.ResourceNotFoundException;
import UserManagement.exception.UnauthorizedException;
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
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        sessionRepository.revokeAllByUserId(user.getUserId());
        return "Password changed successfully. Please log in again.";
    }

    @Transactional
    public String deleteMyAccount(String email) {
        User user = findByEmailOrThrow(email);
        sessionRepository.revokeAllByUserId(user.getUserId());
        userRepository.delete(user);
        return "Account deleted successfully.";
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public String deleteUserById(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        sessionRepository.revokeAllByUserId(userId);
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
                .createdAt(user.getCreatedAt())
                .build();
    }
}
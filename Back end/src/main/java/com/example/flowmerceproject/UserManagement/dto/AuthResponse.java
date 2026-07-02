package com.example.flowmerceproject.UserManagement.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private long expiresIn;
    private UserInfo user;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserInfo {
        /** CON-11: renamed id → userId to match frontend AuthResponse.user.userId */
        private Integer userId;
        /** CON-11: renamed name → fullName to match frontend AuthResponse.user.fullName */
        private String fullName;
        private String email;
        private String phone;
        private String address;
        private String city;
        private String role;
        private LocalDateTime createdAt;
    }
}

package com.example.flowmerceproject.UserManagement.dto;

import com.example.flowmerceproject.UserManagement.entity.Role;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL) //to skip null fields in JSON
public class UserResponse {
    private Integer userId;
    private String email;
    private String fullName;
    private String phone;
    private String address;
    private String city;
    private Role role;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private Boolean isMfaEnabled;
}
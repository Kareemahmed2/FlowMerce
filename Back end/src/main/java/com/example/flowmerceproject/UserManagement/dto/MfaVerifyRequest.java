package com.example.flowmerceproject.UserManagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MfaVerifyRequest {
    @NotBlank
    private String email;
    @NotBlank
    private String otp;
}

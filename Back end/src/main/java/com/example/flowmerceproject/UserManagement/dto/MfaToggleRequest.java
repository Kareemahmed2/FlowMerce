package com.example.flowmerceproject.UserManagement.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MfaToggleRequest {
    @NotNull(message = "enabled is required")
    private Boolean enabled;
}

package com.example.flowmerceproject.UserManagement.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.example.flowmerceproject.UserManagement.entity.Role;  // Import your enum
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    private String fullName;

    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    private String phone;

    private String address;

    private String city;

    private String businessName;

    // Optional: if not provided, defaults to BUYER
    private Role role;  // Changed to enum for type-safety

    // Optional: store slug — used for customer registration to send the
    // activation email to /store/{storeSlug}/activate instead of /activate
    private String storeSlug;
}
package UserManagement.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class PasswordDTOs {

    @Data
    public static class ForgotPasswordRequest {
        @Email
        @NotBlank
        private String email;
    }

    @Data
    public static class ResetPasswordRequest {
        @NotBlank(message = "Token is required")
        private String token;

        @NotBlank(message = "New password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        private String newPassword;
    }
}
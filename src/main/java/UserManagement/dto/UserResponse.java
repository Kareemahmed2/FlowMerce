package UserManagement.dto;

import UserManagement.entity.Role;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserResponse {
    private Integer userId;
    private String email;
    private String fullName;
    private String phone;
    private Role role;
    private Boolean isMfaEnabled;
    private LocalDateTime createdAt;
}
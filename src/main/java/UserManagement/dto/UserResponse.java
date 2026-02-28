package UserManagement.dto;

import UserManagement.entity.Role;
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
    private Role role;
    private Boolean isMfaEnabled;
    private LocalDateTime createdAt;
}
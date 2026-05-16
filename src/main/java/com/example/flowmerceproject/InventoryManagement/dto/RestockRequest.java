package com.example.flowmerceproject.InventoryManagement.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class RestockRequest {
    @NotNull @Positive
    private Integer quantity;
    private String note;
}

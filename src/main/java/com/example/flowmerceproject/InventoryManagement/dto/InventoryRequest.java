package com.example.flowmerceproject.InventoryManagement.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class InventoryRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Quantity is required")
    private Integer quantity;

    // "NORMAL", "RESERVED", "FLASH" — defaults to NORMAL
    private String strategyType = "NORMAL";
}
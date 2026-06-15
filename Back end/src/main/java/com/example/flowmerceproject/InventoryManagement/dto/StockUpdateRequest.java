package com.example.flowmerceproject.InventoryManagement.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockUpdateRequest {
    @NotNull
    private Integer quantity;
    private String note;
}

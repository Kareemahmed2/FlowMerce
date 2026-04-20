package com.example.flowmerceproject.Inventory.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryResponse {
    private Long productId;
    private Integer availableQuantity;
}
package com.example.flowmerceproject.InventoryMangement.dto;

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
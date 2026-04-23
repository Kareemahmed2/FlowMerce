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
    private Integer reservedQuantity;
    private Integer totalQuantity;
    private String stockStatus; // NORMAL, LOW, OUT_OF_STOCK
}
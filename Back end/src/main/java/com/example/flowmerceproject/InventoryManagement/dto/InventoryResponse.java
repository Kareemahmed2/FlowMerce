package com.example.flowmerceproject.InventoryManagement.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InventoryResponse {
    private Long productId;
    private Integer storeId;
    private Integer availableQuantity;
    private Integer reservedQuantity;
    private Integer totalQuantity;
    private String stockStatus;
    /** Threshold below which stock is considered low (from Inventory.lowStockThreshold). */
    private Integer lowStockThreshold;
    /** ISO-8601 timestamp of the last stock change. */
    private java.time.LocalDateTime lastUpdated;
}

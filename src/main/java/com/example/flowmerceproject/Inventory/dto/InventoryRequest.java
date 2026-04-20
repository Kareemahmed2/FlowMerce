package com.example.flowmerceproject.Inventory.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class InventoryRequest {
    private Long productId;
    private Integer quantity;
}
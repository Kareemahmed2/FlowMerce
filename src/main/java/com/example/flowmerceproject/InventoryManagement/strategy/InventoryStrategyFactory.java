package com.example.flowmerceproject.InventoryManagement.strategy;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class InventoryStrategyFactory {

    private final Map<String, InventoryStrategy> strategies;

    public InventoryStrategy getStrategy(String type) {
        InventoryStrategy strategy = strategies.get(type.toUpperCase());
        if (strategy == null) {
            throw new IllegalArgumentException(
                    "Unknown strategy: " + type + ". Valid: NORMAL, RESERVED, FLASH");
        }
        return strategy;
    }
}

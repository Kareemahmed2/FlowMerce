package com.example.flowmerceproject.InventoryManagement.strategy;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class InventoryStrategyFactory {

    // Spring automatically injects all beans that implement InventoryStrategy into this Map.
// This is NOT a traditional Factory Pattern
// Instead, Spring handles object creation and wiring using Dependency Injection.
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
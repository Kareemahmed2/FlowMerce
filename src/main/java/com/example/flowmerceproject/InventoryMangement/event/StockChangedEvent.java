package com.example.flowmerceproject.InventoryMangement.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class StockChangedEvent extends ApplicationEvent {

    private final Long productId;
    private final int newQuantity;
    private final int threshold;
    private final String changeType; // ADJUSTED, RESERVED, RELEASED, CONFIRMED

    public StockChangedEvent(Object source, Long productId,
                             int newQuantity, int threshold, String changeType) {
        super(source);
        this.productId   = productId;
        this.newQuantity = newQuantity;
        this.threshold   = threshold;
        this.changeType  = changeType;
    }
}
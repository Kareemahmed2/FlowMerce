package com.example.flowmerceproject.InventoryManagement.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_transactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InventoryTransaction {

    public enum Type { RESTOCK, SALE, RETURN, ADJUSTMENT, DAMAGE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "txn_id")
    private Long txnId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "store_id", nullable = false)
    private Integer storeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private Type type;

    @Column(name = "quantity_change", nullable = false)
    private Integer quantityChange;

    @Column(name = "qty_before", nullable = false)
    private Integer qtyBefore;

    @Column(name = "qty_after", nullable = false)
    private Integer qtyAfter;

    @Column(name = "reference_id", length = 50)
    private String referenceId;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;
}

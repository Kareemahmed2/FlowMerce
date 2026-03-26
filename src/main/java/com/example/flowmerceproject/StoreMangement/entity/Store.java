package com.example.flowmerceproject.StoreMangement.entity;

import com.example.flowmerceproject.UserManagement.entity.Merchant;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "stores")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "store_id")
    private Integer storeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(name = "store_name", nullable = false, length = 150)
    private String storeName;

    @Column(name = "store_url", unique = true, length = 255)
    private String storeUrl;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "logo", length = 255)
    private String logo;

    // DRAFT, PUBLISHED, DEACTIVATED
    @Column(name = "status", length = 50)
    @Builder.Default
    private String status = "DRAFT";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // One store has one settings object
    @OneToOne(mappedBy = "store", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private StoreSettings settings;
}
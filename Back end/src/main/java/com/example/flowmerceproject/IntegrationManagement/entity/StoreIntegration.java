package com.example.flowmerceproject.IntegrationManagement.entity;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * One row per (store, provider) — holds that store's own encrypted credentials
 * for a third-party gateway/carrier. FlowMerce never has a shared account of its
 * own for any of these providers; every outbound call uses the owning store's row.
 */
@Entity
@Table(name = "store_integrations",
        uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "provider"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreIntegration {

    public enum Provider { PAYMOB, DHL, ARAMEX, BOSTA }

    public enum VerificationStatus { UNVERIFIED, SUCCESS, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "integration_id")
    private Integer integrationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 20, nullable = false)
    private Provider provider;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = false;

    /** AES-GCM encrypted JSON blob of a Map&lt;String,String&gt; — see CredentialEncryptionService. */
    @Column(name = "credentials_encrypted", columnDefinition = "TEXT", nullable = false)
    private String credentialsEncrypted;

    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_verified_status", length = 20)
    private VerificationStatus lastVerifiedStatus;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

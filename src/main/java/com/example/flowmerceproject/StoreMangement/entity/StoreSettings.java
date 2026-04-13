package com.example.flowmerceproject.StoreMangement.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "store_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "settings_id")
    private Integer settingsId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false, unique = true)
    private Store store;

    @Column(name = "currency", length = 10)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "timezone", length = 100)
    @Builder.Default
    private String timezone = "UTC";

    @Column(name = "language", length = 20)
    @Builder.Default
    private String language = "en";

    @Column(name = "tax_settings", columnDefinition = "TEXT")
    private String taxSettings;

    @Column(name = "shipping_settings", columnDefinition = "TEXT")
    private String shippingSettings;
}
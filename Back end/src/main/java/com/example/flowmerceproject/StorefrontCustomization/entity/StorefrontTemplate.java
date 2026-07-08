package com.example.flowmerceproject.StorefrontCustomization.entity;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * StorefrontTemplate is the top-level aggregate for a merchant's online store presentation.
 *
 * It ties together:
 *   • The parent {@link Store}        (slug, URL, merchant ownership)
 *   • A {@link ThemeTemplate}         (six spec §3.3 colour tokens)
 *   • A collection of {@link Page}    (each holding ordered BaseComponents)
 *
 * One Store → One StorefrontTemplate (1:1 for MVP).
 *
 * The {@code version} counter is bumped on every publish so the Next.js
 * frontend can bust its static cache (ISR revalidation tag).
 */
@Entity
@Table(name = "storefront_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StorefrontTemplate {

    public enum StorefrontStatus {
        DRAFT,      // Being edited — not publicly accessible
        PUBLISHED,  // Live — accessible via store URL
        PAUSED      // Soft-offline — merchant has temporarily hidden it
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "template_id")
    private Long templateId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Store store;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "theme_id")
    private ThemeTemplate theme;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private StorefrontStatus status = StorefrontStatus.DRAFT;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @OneToMany(mappedBy = "storefrontTemplate", cascade = CascadeType.ALL,
               orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("navOrder ASC")
    @Builder.Default
    private List<Page> pages = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

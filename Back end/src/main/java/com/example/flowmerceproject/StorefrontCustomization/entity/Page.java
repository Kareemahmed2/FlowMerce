package com.example.flowmerceproject.StorefrontCustomization.entity;

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
 * Page represents a single navigable route in a merchant's published storefront.
 * Examples: Home (/), About Us (/about), Contact (/contact), custom landing pages.
 *
 * A Page belongs to one {@link StorefrontTemplate} and holds an ordered list of
 * {@link BaseComponent}s rendered top-to-bottom by sortOrder.
 *
 * The HOME page (slug="home") is auto-created when a StorefrontTemplate is
 * initialised and cannot be deleted.
 */
@Entity
@Table(
    name = "storefront_pages",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_storefront_page_slug",
        columnNames = {"storefront_id", "slug"}
    )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Page {

    public enum PageType {
        HOME,    // Root "/" — one per storefront, auto-created
        ABOUT,   // /about
        CONTACT, // /contact
        CUSTOM   // Any merchant-defined slug
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "page_id")
    private Long pageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "storefront_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private StorefrontTemplate storefrontTemplate;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    /**
     * URL slug — unique within the storefront.
     * "home" is reserved for the root HOME page.
     */
    @Column(name = "slug", nullable = false, length = 100)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "page_type", nullable = false, length = 20)
    @Builder.Default
    private PageType pageType = PageType.CUSTOM;

    @Column(name = "is_published", nullable = false)
    @Builder.Default
    private Boolean isPublished = false;

    @Column(name = "meta_description", length = 300)
    private String metaDescription;

    @Column(name = "nav_order", nullable = false)
    @Builder.Default
    private Integer navOrder = 0;

    @Column(name = "show_in_nav", nullable = false)
    @Builder.Default
    private Boolean showInNav = true;

    @OneToMany(mappedBy = "page", cascade = CascadeType.ALL,
               orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    @Builder.Default
    private List<BaseComponent> components = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

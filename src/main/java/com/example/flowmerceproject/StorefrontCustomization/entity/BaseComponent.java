package com.example.flowmerceproject.StorefrontCustomization.entity;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;


@Entity
@Table(name = "base_components")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BaseComponent {

    public enum ComponentType {
        NAVBAR,
        BREADCRUMBS,
        SEARCH_BUTTON,
        HERO_BANNER,
        PRODUCT_GRID,
        FEATURED_PRODUCT,
        TEXT_BLOCK,
        IMAGE_GALLERY,
        CALL_TO_ACTION,
        TESTIMONIALS,
        NEWSLETTER_SIGNUP,
        VIDEO_EMBED,
        DIVIDER,
        CUSTOM_HTML
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "component_id")
    private Long componentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "page_id", nullable = false)
    private Page page;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", nullable = false, length = 50)
    private ComponentType componentType;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** JSON string — structure varies by componentType (see class Javadoc). */
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    /** Vertical render order within the page (lower = higher on screen). */
    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    /**
     * Core flag: whether this component should be rendered or hidden on the frontend.
     * The frontend must check this before rendering the component.
     */
    @Column(name = "is_visible", nullable = false)
    @Builder.Default
    private Boolean isVisible = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

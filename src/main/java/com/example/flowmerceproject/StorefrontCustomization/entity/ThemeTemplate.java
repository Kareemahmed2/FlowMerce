package com.example.flowmerceproject.StorefrontCustomization.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * ThemeTemplate holds the six colour tokens for a merchant's storefront.
 *
 * Each field maps to a CSS custom property injected at render time:
 *   --color-background, --color-header, --color-footer,
 *   --color-accent, --color-text, --color-card
 *
 * Schema mirrors spec §3.3 "Theme Colors Schema" exactly — no additional fields.
 *
 * Relationship: One ThemeTemplate ↔ One StorefrontTemplate (1:1).
 */
@Entity
@Table(name = "theme_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThemeTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "theme_id")
    private Long themeId;

    /** Page background hex — e.g. #FFFFFF */
    @Column(name = "background", nullable = false, length = 7)
    @Builder.Default
    private String background = "#FFFFFF";

    /** Header / navbar hex — e.g. #1A1A2E */
    @Column(name = "header", nullable = false, length = 7)
    @Builder.Default
    private String header = "#1A1A2E";

    /** Footer hex — e.g. #16213E */
    @Column(name = "footer", nullable = false, length = 7)
    @Builder.Default
    private String footer = "#16213E";

    /** Buttons / CTAs hex — e.g. #E94560 */
    @Column(name = "accent", nullable = false, length = 7)
    @Builder.Default
    private String accent = "#E94560";

    /** Body text hex — e.g. #1A1A1A */
    @Column(name = "text_color", nullable = false, length = 7)
    @Builder.Default
    private String text = "#1A1A1A";

    /** Product card surface hex — e.g. #F9F9F9 */
    @Column(name = "card", nullable = false, length = 7)
    @Builder.Default
    private String card = "#F9F9F9";

    @OneToOne(mappedBy = "theme", fetch = FetchType.LAZY)
    private StorefrontTemplate storefront;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

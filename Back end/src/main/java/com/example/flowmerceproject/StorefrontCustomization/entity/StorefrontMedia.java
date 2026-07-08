package com.example.flowmerceproject.StorefrontCustomization.entity;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "storefront_media")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StorefrontMedia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "media_id")
    private Long mediaId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Store store;

    @Column(name = "url", nullable = false, length = 512)
    private String url;

    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "media_type", nullable = false, length = 50)
    @Builder.Default
    private String mediaType = "IMAGE";

    @CreationTimestamp
    @Column(name = "uploaded_at", updatable = false)
    private LocalDateTime uploadedAt;
}

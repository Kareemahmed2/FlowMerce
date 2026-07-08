package com.example.flowmerceproject.ProductManagement.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "product_media")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProductMedia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "media_id")
    private Integer mediaId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Product product;

    @Column(name = "media_url", nullable = false, length = 255)
    private String mediaUrl;

    @Column(name = "media_type", length = 50)
    @Builder.Default
    private String mediaType = "IMAGE";

    @Column(name = "alt_text", length = 255)
    private String altText;
}

package com.example.flowmerceproject.FileStorage.entity;

import com.example.flowmerceproject.UserManagement.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_metadata")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FileMetadata {

    public enum FileType {
        IMAGE, PDF, VIDEO, DOCUMENT
    }

    public enum EntityType {
        PRODUCT,    // product image
        STORE,      // store logo or banner
        THEME,      // theme background or asset
        USER,       // profile picture
        ORDER,      // invoice PDF
        STOREFRONT, // storefront page image or banner
        ATTACHMENT, // notification attachment
        AI_ASSET    // AI generated content
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    // Full URL stored in MinIO e.g. http://localhost:9000/flowmerce/products/1/42/uuid.jpg
    @Column(name = "file_url", nullable = false, length = 512)
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", length = 50)
    private FileType fileType;

    // Which entity owns this file
    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", length = 50)
    private EntityType entityType;

    // ID of the owning entity (productId, storeId, orderId, userId, etc.)
    @Column(name = "entity_id")
    private Integer entityId;

    @Column(name = "bucket_name", length = 100)
    @Builder.Default
    private String bucketName = "flowmerce";

    @Column(name = "folder", length = 100)
    private String folder;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "content_type", length = 100)
    private String contentType;

    // Who uploaded this file
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    @CreationTimestamp
    @Column(name = "uploaded_at", updatable = false)
    private LocalDateTime uploadedAt;

    // Soft delete — file marked deleted but not removed from MinIO yet
    @Column(name = "is_deleted")
    @Builder.Default
    private Boolean isDeleted = false;
}
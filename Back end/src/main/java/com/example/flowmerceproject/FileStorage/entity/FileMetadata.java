package com.example.flowmerceproject.FileStorage.entity;

import com.example.flowmerceproject.UserManagement.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "file_metadata")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "file_id")
    private Long id;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", nullable = false, length = 20)
    private FileType fileType;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 20)
    private EntityType entityType;

    @Column(name = "entity_id")
    private Integer entityId;

    @Column(name = "bucket_name", nullable = false)
    private String bucketName;

    @Column(name = "folder")
    private String folder;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "content_type")
    private String contentType;

    @ManyToOne
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted;

    public enum FileType {
        IMAGE, PDF, VIDEO, DOCUMENT
    }

    public enum EntityType {
        PRODUCT, STORE, THEME, USER, ORDER, ATTACHMENT, STOREFRONT
    }
}

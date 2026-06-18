package com.example.flowmerceproject.FileStorage.repository;

import com.example.flowmerceproject.FileStorage.entity.FileMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadata, Long> {

    // Get all files for a specific entity
    // e.g. all images for product 42
    List<FileMetadata> findByEntityTypeAndEntityIdAndIsDeleted(
            FileMetadata.EntityType entityType,
            Integer entityId,
            Boolean isDeleted
    );

    // Get file by URL — used when deleting
    Optional<FileMetadata> findByFileUrl(String fileUrl);

    // Get all files uploaded by a user
    List<FileMetadata> findByUploadedBy_UserIdAndIsDeleted(
            Integer userId, Boolean isDeleted
    );

    // Get all invoices — PDFs for a specific order
    Optional<FileMetadata> findByEntityTypeAndEntityId(
            FileMetadata.EntityType entityType,
            Integer entityId
    );
}
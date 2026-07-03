package com.example.flowmerceproject.FileStorage.service;

import com.example.flowmerceproject.FileStorage.entity.FileMetadata;
import com.example.flowmerceproject.FileStorage.repository.FileMetadataRepository;
import com.example.flowmerceproject.FileStorage.util.StorageFolder;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileStorageService {

    private final MinioClient minioClient;
    private final FileMetadataRepository metadataRepository;
    private final UserRepository userRepository;

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Value("${minio.url}")
    private String minioUrl;

    // Public-facing base URL for links returned to the browser — may differ from
    // minioUrl (the endpoint the backend itself connects to), e.g. when MinIO sits
    // behind a different public host/port than the one the backend reaches it on.
    @Value("${minio.public-url}")
    private String minioPublicUrl;

    // ─────────────────────────────────────────────
    // UPLOAD FILE
    // Uploads to MinIO and saves metadata to DB
    // ─────────────────────────────────────────────
    public FileMetadata uploadFile(MultipartFile file,
                                   StorageFolder folder,
                                   String subPath,
                                   FileMetadata.EntityType entityType,
                                   Integer entityId,
                                   String uploaderEmail) {
        try {
            ensureBucketExists();

            String extension  = getExtension(file.getOriginalFilename());
            String uniqueName = UUID.randomUUID() + extension;
            String objectName = folder.getPath() + "/" + subPath + "/" + uniqueName;

            // 1. Upload to MinIO
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );

            String fileUrl = minioPublicUrl + "/" + bucketName + "/" + objectName;

            // 2. Determine file type
            FileMetadata.FileType fileType = resolveFileType(file.getContentType());

            // 3. Get uploader
            User uploader = null;
            if (uploaderEmail != null) {
                uploader = userRepository.findByEmail(uploaderEmail).orElse(null);
            }

            // 4. Save metadata to DB
            FileMetadata metadata = FileMetadata.builder()
                    .fileName(file.getOriginalFilename())
                    .fileUrl(fileUrl)
                    .fileType(fileType)
                    .entityType(entityType)
                    .entityId(entityId)
                    .bucketName(bucketName)
                    .folder(folder.getPath())
                    .sizeBytes(file.getSize())
                    .contentType(file.getContentType())
                    .uploadedBy(uploader)
                    .isDeleted(false)
                    .build();

            metadataRepository.save(metadata);

            log.info("File uploaded: url={}, entity={}, id={}",
                    fileUrl, entityType, entityId);

            return metadata;

        } catch (Exception e) {
            log.error("Upload failed: {}", e.getMessage());
            throw new RuntimeException("File upload failed: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────
    // DELETE FILE
    // Soft deletes from DB + removes from MinIO
    // ─────────────────────────────────────────────
    public void deleteFile(String fileUrl) {
        try {
            // 1. Soft delete in DB
            metadataRepository.findByFileUrl(fileUrl).ifPresent(meta -> {
                meta.setIsDeleted(true);
                metadataRepository.save(meta);
            });

            // 2. Remove from MinIO
            String objectName = fileUrl.replace(
                    minioPublicUrl + "/" + bucketName + "/", "");
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .build()
            );

            log.info("File deleted: {}", fileUrl);

        } catch (Exception e) {
            log.error("Delete failed: {}", e.getMessage());
            throw new RuntimeException("File deletion failed: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────
    // GET FILES FOR ENTITY
    // e.g. all images for product 42
    // ─────────────────────────────────────────────
    public List<FileMetadata> getFilesForEntity(FileMetadata.EntityType entityType,
                                                Integer entityId) {
        return metadataRepository.findByEntityTypeAndEntityIdAndIsDeleted(
                entityType, entityId, false);
    }

    // ─────────────────────────────────────────────
    // GET PRESIGNED URL — temporary URL (1 hour)
    // Use for private files like invoices
    // ─────────────────────────────────────────────
    public String getPresignedUrl(String objectName) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .method(Method.GET)
                            .expiry(1, TimeUnit.HOURS)
                            .build()
            );
        } catch (Exception e) {
            throw new RuntimeException("Could not generate URL: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────
    // VALIDATE FILE
    // ─────────────────────────────────────────────
    public void validateImageFile(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null ||
                (!contentType.startsWith("image/") &&
                        !contentType.equals("application/pdf"))) {
            throw new IllegalArgumentException(
                    "Only image files and PDFs are allowed.");
        }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException("File size exceeds 10MB limit.");
        }
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    private void ensureBucketExists() throws Exception {
        boolean exists = minioClient.bucketExists(
                BucketExistsArgs.builder().bucket(bucketName).build());
        if (!exists) {
            minioClient.makeBucket(
                    MakeBucketArgs.builder().bucket(bucketName).build());
            log.info("Bucket created: {}", bucketName);
        }

        // Files are served by handing their MinIO URL straight to the browser
        // (product images, logos, etc.), so the bucket must allow anonymous GETs.
        // Idempotent — safe to re-apply on every upload, and covers buckets that
        // already existed before this policy was introduced.
        minioClient.setBucketPolicy(
                SetBucketPolicyArgs.builder()
                        .bucket(bucketName)
                        .config(publicReadPolicy(bucketName))
                        .build());
    }

    private String publicReadPolicy(String bucket) {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {"AWS": ["*"]},
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return ".bin";
        return filename.substring(filename.lastIndexOf("."));
    }

    private FileMetadata.FileType resolveFileType(String contentType) {
        if (contentType == null) return FileMetadata.FileType.DOCUMENT;
        if (contentType.startsWith("image/"))        return FileMetadata.FileType.IMAGE;
        if (contentType.equals("application/pdf"))   return FileMetadata.FileType.PDF;
        if (contentType.startsWith("video/"))        return FileMetadata.FileType.VIDEO;
        return FileMetadata.FileType.DOCUMENT;
    }
}
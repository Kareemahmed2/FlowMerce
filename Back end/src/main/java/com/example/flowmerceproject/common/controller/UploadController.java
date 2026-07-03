package com.example.flowmerceproject.common.controller;

import com.example.flowmerceproject.FileStorage.entity.FileMetadata;
import com.example.flowmerceproject.FileStorage.service.FileStorageService;
import com.example.flowmerceproject.FileStorage.util.StorageFolder;
import com.example.flowmerceproject.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final FileStorageService fileStorageService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    /**
     * POST /api/v1/uploads
     * Accepts multipart/form-data with field "file". Stored in MinIO.
     * Returns { data: { url: "<minio public url>/flowmerce/uploads/..." } }
     * Public endpoint (see SecurityConfig /uploads/** permitAll) — principal may be null.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            Principal principal,
            @RequestPart("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.<Map<String, String>>ok(null, "File is empty"));
        }

        // SEC-11: validate MIME type — images only, but explicitly block SVG and HTML
        // which browsers execute as scripts even when served as image/*.
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.<Map<String, String>>ok(null, "Only image files are allowed"));
        }
        if (contentType.contains("svg") || contentType.contains("html")
                || contentType.contains("xml") || contentType.contains("javascript")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.<Map<String, String>>ok(null, "File type not permitted"));
        }

        // Limit size: 10 MB
        if (file.getSize() > 10 * 1024 * 1024) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.<Map<String, String>>ok(null, "File size must not exceed 10 MB"));
        }

        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.UPLOADS,
                "misc",
                FileMetadata.EntityType.ATTACHMENT,
                null,
                principal != null ? principal.getName() : null
        );

        return ResponseEntity.ok(ApiResponse.ok(Map.of("url", meta.getFileUrl()), "File uploaded successfully"));
    }

    /**
     * GET /api/v1/uploads/{filename}
     * Serves the uploaded file. Public — no auth required.
     */
    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> serve(@PathVariable String filename) {
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path filePath = uploadPath.resolve(filename).normalize();

            // Security: prevent path traversal
            if (!filePath.startsWith(uploadPath)) {
                return ResponseEntity.badRequest().build();
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = Files.probeContentType(filePath);
            if (contentType == null) contentType = "application/octet-stream";

            // SEC-11: only the raster image types validated at upload time (see upload()
            // above) get served inline so <img> tags can render them — anything else
            // (the .bin fallback for an unrecognized type) is forced to download instead,
            // so a rogue SVG/HTML that somehow slipped through can't execute as a document.
            boolean isSafeRasterImage = contentType.equals("image/jpeg")
                    || contentType.equals("image/png")
                    || contentType.equals("image/gif")
                    || contentType.equals("image/webp")
                    || contentType.equals("image/avif");
            String disposition = (isSafeRasterImage ? "inline" : "attachment")
                    + "; filename=\"" + filename + "\"";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000")
                    .header("X-Content-Type-Options", "nosniff")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);

        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}

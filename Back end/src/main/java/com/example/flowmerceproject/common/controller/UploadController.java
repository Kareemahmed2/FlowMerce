package com.example.flowmerceproject.common.controller;

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
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/uploads")
@RequiredArgsConstructor
public class UploadController {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;

    /**
     * POST /api/v1/uploads
     * Accepts multipart/form-data with field "file".
     * Returns { data: { url: "http://localhost:8080/api/v1/uploads/{filename}" } }
     * Requires authentication (any logged-in user).
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            @RequestPart("file") MultipartFile file) throws IOException {

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

        // Ensure uploads directory exists
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);

        // SEC-11: derive extension from the MIME type, not the user-supplied filename
        // (prevents .svg/.html/.php disguised as image/jpeg).
        String safeExtension = switch (contentType.toLowerCase()) {
            case "image/jpeg" -> ".jpg";
            case "image/png"  -> ".png";
            case "image/gif"  -> ".gif";
            case "image/webp" -> ".webp";
            case "image/avif" -> ".avif";
            default           -> ".bin";  // fallback for edge cases; MIME already validated above
        };
        String filename = UUID.randomUUID().toString().replace("-", "") + safeExtension;

        // Save file
        Path targetPath = uploadPath.resolve(filename);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        // Build public URL
        String url = baseUrl + "/api/v1/uploads/" + filename;

        return ResponseEntity.ok(ApiResponse.ok(Map.of("url", url), "File uploaded successfully"));
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

            // SEC-11: serve as attachment, not inline, so even if a rogue SVG/HTML
            // slipped through it can't execute as a document in the browser.
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
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

package com.example.flowmerceproject.FileStorage.controller;

import com.example.flowmerceproject.FileStorage.entity.FileMetadata;
import com.example.flowmerceproject.FileStorage.service.FileStorageService;
import com.example.flowmerceproject.FileStorage.util.StorageFolder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileStorageService fileStorageService;

    // ── PRODUCT IMAGE ─────────────────────────────
    // POST /api/files/products/{storeId}/{productId}
    @PostMapping("/products/{storeId}/{productId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<FileMetadata> uploadProductImage(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Integer productId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.PRODUCT_IMAGES,
                storeId + "/" + productId,
                FileMetadata.EntityType.PRODUCT,
                productId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── STORE LOGO ────────────────────────────────
    // POST /api/files/stores/{storeId}/logo
    @PostMapping("/stores/{storeId}/logo")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<FileMetadata> uploadStoreLogo(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.STORE_LOGOS,
                String.valueOf(storeId),
                FileMetadata.EntityType.STORE,
                storeId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── STORE BANNER ──────────────────────────────
    // POST /api/files/stores/{storeId}/banner
    @PostMapping("/stores/{storeId}/banner")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<FileMetadata> uploadStoreBanner(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.STORE_BANNERS,
                String.valueOf(storeId),
                FileMetadata.EntityType.STORE,
                storeId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── THEME ASSET ───────────────────────────────
    // POST /api/files/themes/{storeId}
    @PostMapping("/themes/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<FileMetadata> uploadThemeAsset(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.THEME_ASSETS,
                String.valueOf(storeId),
                FileMetadata.EntityType.THEME,
                storeId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── USER PROFILE PICTURE ──────────────────────
    // POST /api/files/profiles/{userId}
    @PostMapping("/profiles/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FileMetadata> uploadProfilePicture(
            Principal principal,
            @PathVariable Integer userId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.USER_PROFILES,
                String.valueOf(userId),
                FileMetadata.EntityType.USER,
                userId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── INVOICE PDF ───────────────────────────────
    // POST /api/files/invoices/{orderId}
    @PostMapping("/invoices/{orderId}")
    @PreAuthorize("hasRole('MERCHANT') or hasRole('ADMIN')")
    public ResponseEntity<FileMetadata> uploadInvoice(
            Principal principal,
            @PathVariable Integer orderId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.INVOICES,
                String.valueOf(orderId),
                FileMetadata.EntityType.ORDER,
                orderId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── NOTIFICATION ATTACHMENT ───────────────────
    // POST /api/files/attachments
    @PostMapping("/attachments")
    @PreAuthorize("hasRole('MERCHANT') or hasRole('ADMIN')")
    public ResponseEntity<FileMetadata> uploadAttachment(
            Principal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Integer entityId) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.ATTACHMENTS,
                principal.getName().replace("@", "_"),
                FileMetadata.EntityType.ATTACHMENT,
                entityId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── STOREFRONT IMAGE ──────────────────────────
    // POST /api/files/storefront/{storeId}
    @PostMapping("/storefront/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<FileMetadata> uploadStorefrontImage(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestParam("file") MultipartFile file) {

        fileStorageService.validateImageFile(file);
        FileMetadata meta = fileStorageService.uploadFile(
                file,
                StorageFolder.STOREFRONT,
                String.valueOf(storeId),
                FileMetadata.EntityType.STOREFRONT,
                storeId,
                principal.getName()
        );
        return ResponseEntity.ok(meta);
    }

    // ── GET FILES FOR ENTITY ──────────────────────
    // GET /api/files?entityType=PRODUCT&entityId=42
    @GetMapping
    public ResponseEntity<List<FileMetadata>> getFilesForEntity(
            @RequestParam FileMetadata.EntityType entityType,
            @RequestParam Integer entityId) {
        return ResponseEntity.ok(
                fileStorageService.getFilesForEntity(entityType, entityId));
    }

    // ── DELETE FILE ───────────────────────────────
    // DELETE /api/files?url=...
    @DeleteMapping
    @PreAuthorize("hasRole('MERCHANT') or hasRole('ADMIN')")
    public ResponseEntity<String> deleteFile(@RequestParam String url) {
        fileStorageService.deleteFile(url);
        return ResponseEntity.ok("File deleted successfully.");
    }
}
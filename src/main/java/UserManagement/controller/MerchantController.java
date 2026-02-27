package UserManagement.controller;

import UserManagement.dto.MerchantDTOs;
import UserManagement.service.MerchantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/merchants")
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantService merchantService;

    // POST /api/merchants/me  — any logged-in user can become a merchant
    @PostMapping("/me")
    public ResponseEntity<MerchantDTOs.MerchantResponse> createProfile(
            Principal principal,
            @Valid @RequestBody MerchantDTOs.MerchantRequest request) {
        return ResponseEntity.ok(
                merchantService.createMerchantProfile(principal.getName(), request));
    }

    // GET /api/merchants/me
    @GetMapping("/me")
    public ResponseEntity<MerchantDTOs.MerchantResponse> getMyProfile(Principal principal) {
        return ResponseEntity.ok(merchantService.getMerchantProfile(principal.getName()));
    }

    // DELETE /api/merchants/me
    @DeleteMapping("/me")
    public ResponseEntity<String> deleteMyAccount(Principal principal) {
        return ResponseEntity.ok(merchantService.deleteMerchantAccount(principal.getName()));
    }

    // ── ADMIN ENDPOINTS ──────────────────────────

    // GET /api/admin/merchants
    @GetMapping("/api/admin/merchants")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<MerchantDTOs.MerchantResponse>> getAllMerchants() {
        return ResponseEntity.ok(merchantService.getAllMerchants());
    }

    // PUT /api/admin/merchants/{merchantId}/verify
    @PutMapping("/api/admin/merchants/{merchantId}/verify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MerchantDTOs.MerchantResponse> verifyMerchant(
            @PathVariable Integer merchantId) {
        return ResponseEntity.ok(merchantService.verifyMerchant(merchantId));
    }

    // DELETE /api/admin/merchants/{merchantId}
    @DeleteMapping("/api/admin/merchants/{merchantId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteMerchant(@PathVariable Integer merchantId) {
        return ResponseEntity.ok(merchantService.deleteMerchantById(merchantId));
    }
}
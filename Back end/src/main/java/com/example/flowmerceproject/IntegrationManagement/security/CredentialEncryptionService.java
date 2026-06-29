package com.example.flowmerceproject.IntegrationManagement.security;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.security.spec.AlgorithmParameterSpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Encrypts/decrypts merchant-supplied provider credentials at rest.
 * AES/GCM/NoPadding, 256-bit key. Stored format: Base64(IV[12] || ciphertext+tag).
 *
 * Key comes from integration.encryption-key with NO inline default — same
 * fail-fast convention as JwtUtil.secret. Generate with: openssl rand -base64 32
 */
@Component
public class CredentialEncryptionService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private static final int KEY_LENGTH_BYTES = 32;

    @Value("${integration.encryption-key}")
    private String base64Key;

    private SecretKeySpec key;
    private final SecureRandom secureRandom = new SecureRandom();

    @PostConstruct
    void init() {
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "integration.encryption-key is not valid Base64. Generate with: openssl rand -base64 32");
        }
        if (raw.length != KEY_LENGTH_BYTES) {
            throw new IllegalStateException(
                    "integration.encryption-key must decode to 32 bytes (AES-256). Generate with: openssl rand -base64 32");
        }
        key = new SecretKeySpec(raw, "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            AlgorithmParameterSpec spec = new GCMParameterSpec(TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.ENCRYPT_MODE, key, spec);
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] packed = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(ciphertext, 0, packed, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(packed);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to encrypt credentials", e);
        }
    }

    public String decrypt(String packedBase64) {
        try {
            byte[] packed = Base64.getDecoder().decode(packedBase64);
            byte[] iv = Arrays.copyOfRange(packed, 0, IV_LENGTH_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(packed, IV_LENGTH_BYTES, packed.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            AlgorithmParameterSpec spec = new GCMParameterSpec(TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.DECRYPT_MODE, key, spec);
            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Failed to decrypt credentials — key mismatch or corrupted data", e);
        }
    }
}

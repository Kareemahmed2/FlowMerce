package com.example.flowmerceproject.UserManagement.repository;

import com.example.flowmerceproject.UserManagement.entity.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VerificationTokenRepository extends JpaRepository<VerificationToken, String> {

    Optional<VerificationToken> findByTokenAndTypeAndUsedFalse(
            String token, VerificationToken.TokenType type);

    void deleteByEmailAndType(String email, VerificationToken.TokenType type);
}

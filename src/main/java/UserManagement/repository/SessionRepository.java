package UserManagement.repository;

import UserManagement.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Integer> {

    // Find a session by JWT token string (used to validate incoming requests)
    Optional<Session> findByToken(String token);

    // Check if a token is valid (exists and not revoked)
    boolean existsByTokenAndIsRevokedFalse(String token);

    // Revoke a specific token on logout
    @Modifying
    @Transactional
    @Query("UPDATE Session s SET s.isRevoked = true WHERE s.token = :token")
    void revokeByToken(@Param("token") String token);

    // Revoke ALL tokens for a user (e.g. on password change or account lock)
    @Modifying
    @Transactional
    @Query("UPDATE Session s SET s.isRevoked = true WHERE s.user.userId = :userId")
    void revokeAllByUserId(@Param("userId") Integer userId);
}
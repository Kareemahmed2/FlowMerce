package UserManagement.repository;

import UserManagement.entity.Merchant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MerchantRepository extends JpaRepository<Merchant, Integer> {

    // Find the merchant profile linked to a user
    Optional<Merchant> findByUser_UserId(Integer userId);

    // Check if a user already has a merchant profile
    boolean existsByUser_UserId(Integer userId);

    // Admin use: list all verified or unverified merchants
    List<Merchant> findByIsVerified(Boolean isVerified);
}
package UserManagement.repository;

import UserManagement.entity.Role;
import UserManagement.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {

    // Used during login
    Optional<User> findByEmail(String email);

    // Used during registration to check duplicate email
    boolean existsByEmail(String email);

    // Used by admin to list users by role
    List<User> findByRole(Role role);
}
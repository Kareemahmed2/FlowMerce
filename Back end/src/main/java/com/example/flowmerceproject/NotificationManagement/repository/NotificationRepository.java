package com.example.flowmerceproject.NotificationManagement.repository;

import com.example.flowmerceproject.NotificationManagement.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByUser_UserIdOrderByCreatedAtDesc(Integer userId, Pageable pageable);

    long countByUser_UserIdAndIsReadFalse(Integer userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.userId = :userId AND n.isRead = false")
    int markAllReadByUserId(@Param("userId") Integer userId);

    // Hard-delete all notifications for a user (used before deleting the user row)
    @Modifying
    @Transactional
    void deleteByUser_UserId(Integer userId);
}

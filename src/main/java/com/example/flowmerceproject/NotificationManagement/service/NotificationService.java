package com.example.flowmerceproject.NotificationManagement.service;

import com.example.flowmerceproject.NotificationManagement.dto.NotificationDTOs;
import com.example.flowmerceproject.NotificationManagement.entity.Notification;
import com.example.flowmerceproject.NotificationManagement.repository.NotificationRepository;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional
    public void createForUser(String email,
                              Notification.NotificationType type,
                              String title,
                              String message,
                              Integer referenceId,
                              Notification.ReferenceType referenceType) {
        userRepository.findByEmail(email).ifPresentOrElse(user -> {
            notificationRepository.save(Notification.builder()
                    .user(user)
                    .type(type)
                    .title(title)
                    .message(message)
                    .referenceId(referenceId)
                    .referenceType(referenceType)
                    .build());
            log.debug("Notification saved: userId={}, type={}", user.getUserId(), type);
        }, () -> log.warn("createForUser: no user found for email={}", email));
    }

    @Transactional(readOnly = true)
    public Page<NotificationDTOs.NotificationResponse> getMyNotifications(String email, Pageable pageable) {
        User user = resolve(email);
        return notificationRepository
                .findByUser_UserIdOrderByCreatedAtDesc(user.getUserId(), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(String email) {
        User user = resolve(email);
        return notificationRepository.countByUser_UserIdAndIsReadFalse(user.getUserId());
    }

    @Transactional
    public void markRead(String email, Long notificationId) {
        User user = resolve(email);
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));
        if (!n.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("This notification does not belong to you.");
        }
        n.setIsRead(true);
        notificationRepository.save(n);
    }

    @Transactional
    public int markAllRead(String email) {
        User user = resolve(email);
        return notificationRepository.markAllReadByUserId(user.getUserId());
    }

    private User resolve(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private NotificationDTOs.NotificationResponse toResponse(Notification n) {
        return NotificationDTOs.NotificationResponse.builder()
                .notificationId(n.getNotificationId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .isRead(n.getIsRead())
                .referenceId(n.getReferenceId())
                .referenceType(n.getReferenceType())
                .createdAt(n.getCreatedAt())
                .build();
    }
}

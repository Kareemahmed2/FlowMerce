package com.example.flowmerceproject.NotificationManagement.dto;

import com.example.flowmerceproject.NotificationManagement.entity.Notification;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

public class NotificationDTOs {

    @Data
    @Builder
    public static class NotificationResponse {
        private Long notificationId;
        private Notification.NotificationType type;
        private String title;
        private String message;
        private Boolean isRead;
        private Integer referenceId;
        private Notification.ReferenceType referenceType;
        private LocalDateTime createdAt;
    }
}

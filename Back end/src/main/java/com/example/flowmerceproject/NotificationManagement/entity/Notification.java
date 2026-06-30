package com.example.flowmerceproject.NotificationManagement.entity;

import com.example.flowmerceproject.UserManagement.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private String title;

    @Column(length = 500)
    private String message;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private Boolean isRead = false;

    private Integer referenceId;

    @Enumerated(EnumType.STRING)
    private ReferenceType referenceType;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum NotificationType {
        PAYMENT_INITIATED,
        PAYMENT_SUCCEEDED,
        PAYMENT_FAILED,
        PAYMENT_REFUNDED,
        ORDER_PROCESSING,
        ORDER_SHIPPED,
        ORDER_DELIVERED,
        ORDER_CANCELLED
    }

    public enum ReferenceType {
        ORDER, PAYMENT
    }
}
package com.example.flowmerceproject.NotificationManagement.controller;

import com.example.flowmerceproject.NotificationManagement.dto.NotificationDTOs;
import com.example.flowmerceproject.NotificationManagement.service.NotificationService;
import com.example.flowmerceproject.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // GET /notifications?page=0&size=20
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<NotificationDTOs.NotificationResponse>>> getMyNotifications(
            Principal principal,
            @PageableDefault(size = 20, sort = "createdAt",
                             direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(
                notificationService.getMyNotifications(principal.getName(), pageable)));
    }

    // GET /notifications/unread-count
    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(
                notificationService.getUnreadCount(principal.getName())));
    }

    // PUT /notifications/{notificationId}/read
    @PutMapping("/{notificationId}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> markRead(
            Principal principal,
            @PathVariable Long notificationId) {
        notificationService.markRead(principal.getName(), notificationId);
        return ResponseEntity.ok(ApiResponse.ok("Notification marked as read"));
    }

    // PUT /notifications/read-all
    @PutMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> markAllRead(Principal principal) {
        int count = notificationService.markAllRead(principal.getName());
        return ResponseEntity.ok(ApiResponse.ok(count + " notifications marked as read"));
    }
}

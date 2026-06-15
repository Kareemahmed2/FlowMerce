package com.example.flowmerceproject.UserManagement.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void sendActivationEmail(String toEmail, String token) {
        String activationLink = frontendUrl + "/activate?token=" + token;
        String subject = "Activate your FlowMerce account";
        String body = """
                <h2>Welcome to FlowMerce!</h2>
                <p>Please click the link below to activate your account:</p>
                <a href="%s">Activate Account</a>
                <p>This link expires in 24 hours.</p>
                <p>If you did not register, please ignore this email.</p>
                """.formatted(activationLink);
        sendHtmlEmail(toEmail, subject, body);
    }

    /**
     * Customer-specific activation email — links to the store-branded page
     * /store/{storeSlug}/activate so the customer stays within the store context.
     */
    public void sendCustomerActivationEmail(String toEmail, String token, String storeSlug) {
        String activationLink = frontendUrl + "/store/" + storeSlug + "/activate?token=" + token;
        String subject = "Verify your email to start shopping";
        String body = """
                <h2>Almost there!</h2>
                <p>Click the link below to verify your email and activate your account:</p>
                <a href="%s" style="display:inline-block;padding:12px 24px;background:#0F0E0C;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
                    Verify Email
                </a>
                <p>This link expires in 24 hours.</p>
                <p>If you did not create this account, please ignore this email.</p>
                """.formatted(activationLink);
        sendHtmlEmail(toEmail, subject, body);
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetLink = frontendUrl + "/reset-password?token=" + token;
        String subject = "Reset your FlowMerce password";
        String body = """
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password:</p>
                <a href="%s">Reset Password</a>
                <p>This link expires in 1 hour.</p>
                <p>If you did not request this, please ignore this email.</p>
                """.formatted(resetLink);
        sendHtmlEmail(toEmail, subject, body);
    }

    private void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true); // true = HTML
            mailSender.send(message);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}
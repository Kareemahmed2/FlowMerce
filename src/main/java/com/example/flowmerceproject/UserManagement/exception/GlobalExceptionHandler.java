package com.example.flowmerceproject.UserManagement.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // ── 404 ──────────────────────────────────────
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            ResourceNotFoundException ex, HttpServletRequest request) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(ex.toApiResponse(request.getRequestURI()));
    }

    // ── 409 ──────────────────────────────────────
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(
            ConflictException ex, HttpServletRequest request) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(ex.toApiResponse(request.getRequestURI()));
    }

    // ── 401 ──────────────────────────────────────
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(
            UnauthorizedException ex, HttpServletRequest request) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(ex.toApiResponse(request.getRequestURI()));
    }

    // ── 400 ──────────────────────────────────────
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(
            BadRequestException ex, HttpServletRequest request) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(ex.toApiResponse(request.getRequestURI()));
    }

    // ── 403 ──────────────────────────────────────
    @ExceptionHandler({ForbiddenException.class, AccessDeniedException.class})
    public ResponseEntity<ErrorResponse> handleForbidden(
            RuntimeException ex, HttpServletRequest request) {
        // AccessDeniedException comes from Spring Security, doesn't have toApiResponse()
        // so we handle it manually
        if (ex instanceof ForbiddenException fe) {
            return ResponseEntity
                    .status(fe.getStatus())
                    .body(fe.toApiResponse(request.getRequestURI()));
        }
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse.of(403, "Forbidden",
                        "You do not have permission to access this resource.",
                        request.getRequestURI()));
    }

    // ── 400 Validation (@Valid failures) ─────────
    // Returns a map of { "fieldName": "error message" }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }

        Map<String, Object> body = new HashMap<>();
        body.put("status", 400);
        body.put("error", "Validation Failed");
        body.put("path", request.getRequestURI());
        body.put("fields", fieldErrors);

        return ResponseEntity.badRequest().body(body);
    }

    // ── 500 Fallback ──────────────────────────────
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(
            Exception ex, HttpServletRequest request) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(500, "Internal Server Error",
                        "An unexpected error occurred. Please try again later.",
                        request.getRequestURI()));
    }
}
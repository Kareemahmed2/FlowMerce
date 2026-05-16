package com.example.flowmerceproject.UserManagement.exception;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    @Builder.Default
    private boolean success = false;

    private int status;
    private String error;
    private String message;
    private String code;
    private String path;

    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    private Map<String, Object> details;

    @Builder.Default
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime timestamp = LocalDateTime.now();

    public static ErrorResponse of(int status, String error, String message, String code, String path) {
        return ErrorResponse.builder()
                .status(status)
                .error(error)
                .message(message)
                .code(code)
                .path(path)
                .build();
    }

    public static ErrorResponse of(int status, String error, String message, String code,
                                   String path, Map<String, Object> details) {
        return ErrorResponse.builder()
                .status(status)
                .error(error)
                .message(message)
                .code(code)
                .path(path)
                .details(details)
                .build();
    }
}

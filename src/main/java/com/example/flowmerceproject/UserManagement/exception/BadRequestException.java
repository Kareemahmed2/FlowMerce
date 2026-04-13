package com.example.flowmerceproject.UserManagement.exception;
import org.springframework.http.HttpStatus;

public class BadRequestException extends RuntimeException {
    private final HttpStatus status = HttpStatus.BAD_REQUEST;
    private final String error = "Bad Request";

    public BadRequestException(String message) {
        super(message);
    }

    public HttpStatus getStatus() { return status; }
    public String getError()      { return error; }

    public ErrorResponse toApiResponse(String path) {
        return ErrorResponse.builder()
                .status(status.value())
                .error(error)
                .message(getMessage())
                .path(path)
                .build();
    }
}

package UserManagement.exception;
import org.springframework.http.HttpStatus;

public class ConflictException extends RuntimeException {
    private final HttpStatus status = HttpStatus.CONFLICT;
    private final String error = "Conflict";

    public ConflictException(String message) {
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
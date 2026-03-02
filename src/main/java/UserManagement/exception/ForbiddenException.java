package UserManagement.exception;
import org.springframework.http.HttpStatus;

public class ForbiddenException extends RuntimeException {

    private final HttpStatus status = HttpStatus.FORBIDDEN;
    private final String error = "Forbidden";

    public ForbiddenException(String message) {
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
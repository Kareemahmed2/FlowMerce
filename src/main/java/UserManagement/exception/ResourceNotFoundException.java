package UserManagement.exception;
import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends RuntimeException {

    private final HttpStatus status = HttpStatus.NOT_FOUND;
    private final String error = "Not Found";

    public ResourceNotFoundException(String message) {
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
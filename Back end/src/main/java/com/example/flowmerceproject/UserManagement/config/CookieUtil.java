package com.example.flowmerceproject.UserManagement.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * SEC-6: builds and clears httpOnly + Secure JWT cookies so the access token
 * is never accessible via JavaScript (mitigates XSS token theft).
 *
 * Cookies are namespaced per auth scope ("merchant" or "customer") — a single
 * shared cookie name meant a customer login on the storefront silently
 * overwrote the merchant dashboard's session cookie (and vice versa), since
 * both logins shared the same browser/origin. Separate names let both
 * sessions coexist in the same browser.
 */
@Component
public class CookieUtil {

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public static final String MERCHANT_SCOPE = "merchant";
    public static final String CUSTOMER_SCOPE = "customer";

    private boolean isSecure() {
        return frontendUrl.startsWith("https://");
    }

    private static String accessCookieName(String scope) {
        return scope + "_access_token";
    }

    private static String refreshCookieName(String scope) {
        return scope + "_refresh_token";
    }

    /** Set both tokens as httpOnly cookies on the response, namespaced to the given scope. */
    public void setAuthCookies(HttpServletResponse response,
                               String scope,
                               String accessToken,
                               String refreshToken,
                               long accessTtlSeconds,
                               long refreshTtlSeconds) {
        response.addHeader("Set-Cookie",
            ResponseCookie.from(accessCookieName(scope), accessToken)
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1")
                .maxAge(accessTtlSeconds)
                .sameSite("Lax")
                .build().toString());

        response.addHeader("Set-Cookie",
            ResponseCookie.from(refreshCookieName(scope), refreshToken)
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1/auth")   // scoped to auth endpoints only
                .maxAge(refreshTtlSeconds)
                .sameSite("Lax")
                .build().toString());
    }

    /** Clear both auth cookies for the given scope on logout. */
    public void clearAuthCookies(HttpServletResponse response, String scope) {
        response.addHeader("Set-Cookie",
            ResponseCookie.from(accessCookieName(scope), "")
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1")
                .maxAge(0)
                .sameSite("Lax")
                .build().toString());

        response.addHeader("Set-Cookie",
            ResponseCookie.from(refreshCookieName(scope), "")
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Lax")
                .build().toString());
    }

    /** Extract the access token for the given scope (returns null if absent). */
    public static String extractAccessToken(jakarta.servlet.http.HttpServletRequest request, String scope) {
        return extractCookie(request, accessCookieName(scope));
    }

    /** Extract the refresh token for the given scope (returns null if absent). */
    public static String extractRefreshToken(jakarta.servlet.http.HttpServletRequest request, String scope) {
        return extractCookie(request, refreshCookieName(scope));
    }

    private static String extractCookie(jakarta.servlet.http.HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (var c : request.getCookies()) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}

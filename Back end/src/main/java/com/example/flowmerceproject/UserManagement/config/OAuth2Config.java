package com.example.flowmerceproject.UserManagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Provides the RestTemplate bean used by SocialAuthService to call
 * Google and Facebook OAuth2 endpoints.
 */
@Configuration
public class OAuth2Config {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}

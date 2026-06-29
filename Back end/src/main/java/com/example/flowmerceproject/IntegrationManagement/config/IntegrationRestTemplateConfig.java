package com.example.flowmerceproject.IntegrationManagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Dedicated RestTemplate for outbound calls to Paymob/DHL/Aramex/Bosta —
 * kept separate from OAuth2Config's unqualified bean so these provider calls
 * carry their own timeout policy instead of sharing one with OAuth login calls.
 */
@Configuration
public class IntegrationRestTemplateConfig {

    @Bean
    public RestTemplate integrationRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        return new RestTemplate(factory);
    }
}

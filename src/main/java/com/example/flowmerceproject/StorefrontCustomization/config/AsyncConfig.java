package com.example.flowmerceproject.StorefrontCustomization.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enables Spring's asynchronous method execution support for write-behind
 * cache persistence in the storefront customization module.
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}

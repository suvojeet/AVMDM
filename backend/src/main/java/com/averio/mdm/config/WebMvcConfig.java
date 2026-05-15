package com.averio.mdm.config;

import com.averio.mdm.license.LicenseInterceptor;
import com.averio.mdm.license.LicenseService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final LicenseService licenseService;
    private final ObjectMapper   objectMapper;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new LicenseInterceptor(licenseService, objectMapper))
                .addPathPatterns("/api/v1/**")
                .excludePathPatterns(
                        "/api/v1/license",
                        "/api/v1/license/**",
                        "/api/v1/dashboard/**",
                        "/api/v1/ai/**",
                        "/api/v1/chatbot/**",
                        "/api/v1/nlp/**",
                        "/api/v1/steward/**",
                        "/api/v1/governance/**",
                        "/api/v1/ml/**",
                        "/api/v1/audit/**",
                        "/api/v1/enterprise-views/**",
                        "/api/v1/reference-data/**"
                );
    }
}

package com.averio.mdm.config;

import com.azure.ai.openai.OpenAIClient;
import com.azure.ai.openai.OpenAIClientBuilder;
import com.azure.core.credential.AzureKeyCredential;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AzureAIConfig {

    @Value("${averio.ai.endpoint:}")
    private String endpoint;

    @Value("${averio.ai.api-key:}")
    private String apiKey;

    @Bean
    @ConditionalOnProperty(name = "averio.ai.enabled", havingValue = "true", matchIfMissing = false)
    public OpenAIClient openAIClient() {
        return new OpenAIClientBuilder()
                .endpoint(endpoint)
                .credential(new AzureKeyCredential(apiKey))
                .buildClient();
    }

    /** Shared RestTemplate for external HTTP calls (Claude API, etc.) */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}

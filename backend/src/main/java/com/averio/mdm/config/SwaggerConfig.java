package com.averio.mdm.config;

import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.*;
import io.swagger.v3.oas.models.security.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI averioOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Averio MDM API")
                .description("Enterprise Master Data Management Platform — An Averio Company Product. " +
                        "Powers golden record creation, entity resolution, and data governance for " +
                        "Fortune 500 enterprises.")
                .version("1.0.0")
                .contact(new Contact()
                        .name("Averio MDM Support")
                        .email("support@averiomdm.org")
                        .url("https://www.averiomdm.org"))
                .license(new License().name("Enterprise License").url("https://www.averiomdm.org/license")))
            .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
            .components(new Components()
                .addSecuritySchemes("Bearer Authentication",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .bearerFormat("JWT")
                        .scheme("bearer")));
    }
}

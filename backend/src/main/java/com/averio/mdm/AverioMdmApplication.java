package com.averio.mdm;

import com.azure.spring.data.cosmos.repository.config.EnableCosmosRepositories;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.data.neo4j.repository.config.EnableNeo4jRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableCaching
@EnableAsync
@EnableScheduling
@EnableNeo4jRepositories(basePackages = "com.averio.mdm.repository.neo4j")
@EnableCosmosRepositories(basePackages = "com.averio.mdm.repository.cosmos")
public class AverioMdmApplication {

    public static void main(String[] args) {
        SpringApplication.run(AverioMdmApplication.class, args);
    }
}

package com.averio.mdm.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.*;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Configuration
@EnableCaching
public class CacheConfig {

    /** Cache names used by @Cacheable/@CacheEvict across the application. */
    private static final String[] CACHE_NAMES = {
            "parties", "goldenRecords", "survivorshipRules", "matchingRules",
            "governance", "referenceData", "referenceDataActive", "license",
            "dynamicSchemas"
    };

    /**
     * Redis-backed when a connection factory is present and reachable; otherwise an
     * in-memory cache. Redis is optional so the app can run without it (e.g. B1 plans
     * with no VNet integration, where Azure Cache for Redis is unreachable).
     */
    @Bean
    @Primary
    public CacheManager cacheManager(ObjectProvider<RedisConnectionFactory> connectionFactoryProvider) {
        RedisConnectionFactory connectionFactory = connectionFactoryProvider.getIfAvailable();
        if (connectionFactory == null) {
            log.info("Redis not configured — using in-memory cache");
            return new ConcurrentMapCacheManager(CACHE_NAMES);
        }
        try {
            // Test the connection before building the Redis cache manager
            connectionFactory.getConnection().ping();

            RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofMinutes(15))
                    .serializeKeysWith(RedisSerializationContext.SerializationPair
                            .fromSerializer(new StringRedisSerializer()))
                    .serializeValuesWith(RedisSerializationContext.SerializationPair
                            .fromSerializer(new GenericJackson2JsonRedisSerializer()));

            Map<String, RedisCacheConfiguration> cacheConfigs = new java.util.HashMap<>();
            cacheConfigs.put("parties",             defaultConfig.entryTtl(Duration.ofMinutes(30)));
            cacheConfigs.put("goldenRecords",        defaultConfig.entryTtl(Duration.ofMinutes(10)));
            cacheConfigs.put("survivorshipRules",    defaultConfig.entryTtl(Duration.ofHours(1)));
            cacheConfigs.put("matchingRules",        defaultConfig.entryTtl(Duration.ofHours(1)));
            cacheConfigs.put("referenceData",        defaultConfig.entryTtl(Duration.ofMinutes(30)));
            cacheConfigs.put("referenceDataActive",  defaultConfig.entryTtl(Duration.ofMinutes(30)));
            cacheConfigs.put("dynamicSchemas",       defaultConfig.entryTtl(Duration.ofMinutes(10)));

            log.info("Redis connected — using RedisCacheManager");
            return RedisCacheManager.builder(connectionFactory)
                    .cacheDefaults(defaultConfig)
                    .withInitialCacheConfigurations(cacheConfigs)
                    .build();

        } catch (Exception e) {
            log.warn("Redis unavailable ({}), falling back to in-memory cache", e.getMessage());
            return new ConcurrentMapCacheManager(CACHE_NAMES);
        }
    }
}

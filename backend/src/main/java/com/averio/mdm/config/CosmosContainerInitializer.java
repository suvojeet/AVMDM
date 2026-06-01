package com.averio.mdm.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

/**
 * Creates Cosmos DB containers using the REST API directly (no SDK throughput overhead).
 * The SDK's createContainerIfNotExists always sends x-ms-offer-throughput: 400 even without
 * ThroughputProperties, which causes Azure to reject the request when the account is at its
 * 1000 RU/s total limit. Direct REST calls omit that header, so containers are created
 * under the database's existing shared throughput budget.
 */
@Component
@Slf4j
public class CosmosContainerInitializer implements ApplicationRunner {

    @Value("${spring.cloud.azure.cosmos.endpoint}")
    private String endpoint;

    @Value("${spring.cloud.azure.cosmos.key}")
    private String masterKey;

    @Value("${spring.cloud.azure.cosmos.database}")
    private String databaseName;

    private static final List<String[]> CONTAINERS = List.of(
        new String[]{"enterprise-views",    "/department"},
        new String[]{"survivorship-rules",  "/entityType"},
        new String[]{"matching-rules",      "/entityType"},
        new String[]{"data-policies",       "/policyType"},
        new String[]{"timeline-events",     "/entityId"},
        new String[]{"transaction-logs",    "/entityId"},
        new String[]{"system-logs",         "/level"},
        new String[]{"steward-tasks",       "/taskType"},
        new String[]{"matching-feedback",   "/entityType"},
        new String[]{"ml-models",           "/entityType"},
        new String[]{"reference-data",      "/category"},
        new String[]{"reference-categories", "/categoryKey"},
        new String[]{"parties",              "/partyType"},
        new String[]{"accounts",            "/accountType"},
        new String[]{"products",            "/productType"},
        new String[]{"agreements",          "/agreementType"},
        new String[]{"test-runs",           "/suiteName"}
    );

    @Override
    public void run(ApplicationArguments args) {
        if (masterKey == null || masterKey.isBlank()) {
            log.warn("Cosmos DB master key not configured — skipping container initialization");
            return;
        }

        int created = 0, existing = 0, failed = 0;
        for (String[] entry : CONTAINERS) {
            try {
                int status = ensureContainer(entry[0], entry[1]);
                if (status == 201) { created++; log.debug("Created container: {}", entry[0]); }
                else if (status == 409) { existing++; log.debug("Container already exists: {}", entry[0]); }
                else { failed++; log.warn("Unexpected status {} for container: {}", status, entry[0]); }
            } catch (Exception e) {
                failed++;
                log.warn("Could not ensure container '{}': {}", entry[0], e.getMessage());
            }
        }
        log.info("Cosmos container init: {} created, {} already existed, {} failed",
            created, existing, failed);
    }

    private int ensureContainer(String name, String partitionKeyPath) throws Exception {
        String normalizedEndpoint = endpoint.endsWith("/") ? endpoint : endpoint + "/";
        String url = normalizedEndpoint + "dbs/" + databaseName + "/colls";
        String resourceLink = "dbs/" + databaseName;

        String date = ZonedDateTime.now(ZoneOffset.UTC)
            .format(DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US));

        String body = String.format(
            "{\"id\":\"%s\",\"partitionKey\":{\"paths\":[\"%s\"],\"kind\":\"Hash\",\"version\":2}}",
            name, partitionKeyPath);

        String authHeader = buildAuthHeader("post", "colls", resourceLink, date);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", authHeader)
            .header("x-ms-date", date)
            .header("x-ms-version", "2018-12-31")
            .header("Content-Type", "application/json")
            // Intentionally no x-ms-offer-throughput — container inherits database shared throughput
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400 && response.statusCode() != 409) {
            throw new RuntimeException(response.body());
        }
        return response.statusCode();
    }

    private String buildAuthHeader(String verb, String resourceType, String resourceLink, String date)
        throws Exception {
        String stringToSign = verb.toLowerCase(Locale.US) + "\n"
            + resourceType.toLowerCase(Locale.US) + "\n"
            + resourceLink + "\n"
            + date.toLowerCase(Locale.US) + "\n"
            + "\n";

        byte[] keyBytes = Base64.getDecoder().decode(masterKey);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(keyBytes, "HmacSHA256"));
        byte[] sig = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));

        String sigB64 = Base64.getEncoder().encodeToString(sig);
        return URLEncoder.encode("type=master&ver=1.0&sig=" + sigB64, StandardCharsets.UTF_8);
    }
}

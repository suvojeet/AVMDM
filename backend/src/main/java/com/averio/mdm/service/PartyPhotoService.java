package com.averio.mdm.service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.repository.neo4j.PartyRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class PartyPhotoService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );
    private static final Map<String, String> EXT_MAP = Map.of(
            "image/jpeg", "jpg", "image/jpg", "jpg",
            "image/png",  "png", "image/webp", "webp"
    );

    @Value("${averio.storage.connection-string:}")
    private String connectionString;

    @Value("${averio.storage.account-name:averiomdmstorage}")
    private String accountName;

    @Value("${averio.storage.container-name:party-photos}")
    private String containerName;

    @Value("${averio.storage.max-photo-size-mb:5}")
    private int maxPhotoSizeMb;

    private final PartyRepository partyRepository;
    private BlobContainerClient containerClient;
    private boolean storageAvailable = false;

    public PartyPhotoService(PartyRepository partyRepository) {
        this.partyRepository = partyRepository;
    }

    @PostConstruct
    void init() {
        if (connectionString == null || connectionString.isBlank()) {
            log.warn("Azure Storage connection string not configured — photo upload disabled");
            return;
        }
        try {
            BlobServiceClient serviceClient = new BlobServiceClientBuilder()
                    .connectionString(connectionString)
                    .buildClient();
            containerClient = serviceClient.getBlobContainerClient(containerName);
            if (!containerClient.exists()) {
                containerClient.create();
                log.info("Created Azure Blob container: {}", containerName);
            }
            storageAvailable = true;
            log.info("Azure Blob Storage ready — container: {}", containerName);
        } catch (Exception e) {
            log.error("Failed to initialise Azure Blob Storage: {}", e.getMessage());
        }
    }

    public String uploadPhoto(String globalId, MultipartFile file) throws IOException {
        requireStorage();
        validateFile(file);

        Party party = partyRepository.findByGlobalId(globalId)
                .orElseThrow(() -> new IllegalArgumentException("Party not found: " + globalId));

        if (!"INDIVIDUAL".equals(party.getPartyType()) && !"EMPLOYEE".equals(party.getPartyType())) {
            throw new IllegalArgumentException("Photo upload is only supported for INDIVIDUAL and EMPLOYEE parties");
        }

        // Delete existing photo blob if present
        if (party.getPhotoUrl() != null) {
            deleteBlob(blobName(globalId, contentTypeToExt(guessContentType(party.getPhotoUrl()))));
        }

        String ext      = EXT_MAP.getOrDefault(file.getContentType(), "jpg");
        String blobName = globalId + "." + ext;

        BlobClient blobClient = containerClient.getBlobClient(blobName);
        BlobHttpHeaders headers = new BlobHttpHeaders().setContentType(file.getContentType());
        blobClient.upload(file.getInputStream(), file.getSize(), true);
        blobClient.setHttpHeaders(headers);

        String url = buildPublicUrl(blobName);
        party.setPhotoUrl(url);
        party.setUpdatedAt(LocalDateTime.now());
        partyRepository.save(party);

        log.info("Uploaded photo for party {}: {}", globalId, url);
        return url;
    }

    public String getPhotoUrl(String globalId) {
        return partyRepository.findByGlobalId(globalId)
                .map(Party::getPhotoUrl)
                .orElse(null);
    }

    public void deletePhoto(String globalId) {
        requireStorage();
        Party party = partyRepository.findByGlobalId(globalId)
                .orElseThrow(() -> new IllegalArgumentException("Party not found: " + globalId));
        if (party.getPhotoUrl() == null) return;

        for (String ext : EXT_MAP.values()) {
            deleteBlob(globalId + "." + ext);
        }
        party.setPhotoUrl(null);
        party.setUpdatedAt(LocalDateTime.now());
        partyRepository.save(party);
        log.info("Deleted photo for party {}", globalId);
    }

    public boolean isAvailable() {
        return storageAvailable;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private void requireStorage() {
        if (!storageAvailable) {
            throw new IllegalStateException("Photo storage is not configured on this instance");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided");
        }
        if (!ALLOWED_TYPES.contains(file.getContentType())) {
            throw new IllegalArgumentException("Only JPEG, PNG and WebP images are allowed");
        }
        long maxBytes = (long) maxPhotoSizeMb * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException("File exceeds maximum size of " + maxPhotoSizeMb + " MB");
        }
    }

    private void deleteBlob(String blobName) {
        try {
            BlobClient bc = containerClient.getBlobClient(blobName);
            if (bc.exists()) bc.delete();
        } catch (Exception e) {
            log.warn("Could not delete blob {}: {}", blobName, e.getMessage());
        }
    }

    private String buildPublicUrl(String blobName) {
        return "https://" + accountName + ".blob.core.windows.net/" + containerName + "/" + blobName;
    }

    private String blobName(String globalId, String ext) {
        return globalId + "." + ext;
    }

    private String contentTypeToExt(String ct) {
        return EXT_MAP.getOrDefault(ct, "jpg");
    }

    private String guessContentType(String url) {
        if (url == null) return "image/jpeg";
        if (url.endsWith(".png"))  return "image/png";
        if (url.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }
}

package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Address;
import com.averio.mdm.repository.neo4j.PartyAddressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class GdprService {

    private static final int GDPR_RETENTION_YEARS = 7;

    private final PartyAddressRepository addressRepository;

    /**
     * Soft-delete an address.
     * Sets endDate = today and gdprPurgeDate = today + 7 years (GDPR retention).
     * Address is hidden from normal views but retained for compliance.
     */
    public Address softDeleteAddress(String addressId, String reason, String deletedBy) {
        Address address = addressRepository.findByAddressId(addressId)
                .orElseThrow(() -> new NoSuchElementException("Address not found: " + addressId));

        if (address.getEndDate() != null) {
            throw new IllegalStateException("Address " + addressId + " is already soft-deleted");
        }

        LocalDate today = LocalDate.now();
        address.setEndDate(today);
        address.setGdprPurgeDate(today.plusYears(GDPR_RETENTION_YEARS));
        address.setEndReason(reason != null ? reason : "USER_REMOVED");
        address.setUpdatedAt(LocalDateTime.now());
        address.setUpdatedBy(deletedBy);

        log.info("GDPR soft-delete: address {} by {} — purge eligible after {}",
                addressId, deletedBy, address.getGdprPurgeDate());
        return addressRepository.save(address);
    }

    /**
     * Restore a soft-deleted address (admin only — clears GDPR fields).
     */
    public Address restoreAddress(String addressId, String restoredBy) {
        Address address = addressRepository.findByAddressId(addressId)
                .orElseThrow(() -> new NoSuchElementException("Address not found: " + addressId));

        address.setEndDate(null);
        address.setGdprPurgeDate(null);
        address.setEndReason(null);
        address.setUpdatedAt(LocalDateTime.now());
        address.setUpdatedBy(restoredBy);
        return addressRepository.save(address);
    }

    /**
     * Nightly scheduled job: physically delete addresses whose 7-year GDPR retention has expired.
     * Runs at 02:00 every day.
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void purgeExpiredAddresses() {
        try {
            List<Address> purgeable = addressRepository.findPurgeEligible(LocalDate.now());
            if (!purgeable.isEmpty()) {
                log.info("GDPR purge: permanently deleting {} addresses past {}-year retention",
                        purgeable.size(), GDPR_RETENTION_YEARS);
                addressRepository.deleteAll(purgeable);
            }
        } catch (Exception e) {
            log.warn("GDPR purge job skipped (Neo4j unavailable): {}", e.getMessage());
        }
    }
}

package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Address;
import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.repository.neo4j.PartyRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder {

    private final PartyRepository partyRepository;

    @PostConstruct
    void seedSampleParties() {
        try {
            if (partyRepository.count() > 0) {
                log.info("Party data already present — skipping sample seed");
                return;
            }
            log.info("Seeding sample parties…");
            partyRepository.saveAll(List.of(buildIndividual(), buildOrganization()));
            log.info("Sample parties seeded successfully");
        } catch (Exception e) {
            log.warn("Sample party seed skipped — will be available on next restart: {}", e.getMessage());
        }
    }

    // ── Individual ────────────────────────────────────────────────────────────

    private Party buildIndividual() {
        String goldenId = UUID.randomUUID().toString();

        Address home = Address.builder()
                .addressId(UUID.randomUUID().toString())
                .addressType("HOME")
                .isPrimary(true)
                .isVerified(true)
                .verificationSource("USPS_DPV")
                .line1("842 Lakeview Terrace")
                .city("Austin")
                .stateProvince("TX")
                .postalCode("78701")
                .county("Travis")
                .country("United States")
                .countryCode("US")
                .latitude(30.2672)
                .longitude(-97.7431)
                .geoAccuracy("ROOFTOP")
                .dpvConfirmation("Y")
                .effectiveStartDate(LocalDate.of(2019, 6, 1))
                .sourceSystem("CRM_SALESFORCE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("SYSTEM_SEED")
                .build();

        return Party.builder()
                .globalId(goldenId)
                .goldenRecordId(goldenId)
                .partyType("INDIVIDUAL")
                .partySubType("CUSTOMER")
                .status("ACTIVE")

                // Identity
                .salutation("Mr.")
                .firstName("James")
                .middleName("William")
                .lastName("Mitchell")
                .fullName("James William Mitchell")
                .preferredName("Jim")
                .suffix(null)
                .gender("MALE")
                .dateOfBirth(LocalDate.of(1978, 3, 15))
                .nationality("American")
                .countryOfResidence("United States")
                .language("en")

                // Identification
                .ssn("***-**-6789")          // masked at rest
                .passport("P12345678")
                .driversLicense("TX-DL-4892736")
                .nationalId(null)

                // Contact
                .phones(Map.of("MOBILE", "+1-512-555-0142", "WORK", "+1-512-555-0200"))
                .emails(Map.of("PRIMARY", "james.mitchell@email.com", "WORK", "jmitchell@nexusfinancial.com"))
                .websites(Map.of())

                // Source
                .sourceSystem("CRM_SALESFORCE")
                .sourceSystemId("SF-CONTACT-00Q8Z000001ABCD")
                .sourceLastUpdated(LocalDateTime.now().minusDays(3))

                // Golden record metadata
                .isGolden(true)
                .matchScore(1.0)
                .confidenceScore(0.97)
                .dataQualityScore(0.94)
                .completenessScore(0.91)
                .accuracyScore(0.96)
                .survivorshipRuleApplied("MOST_RECENT")

                // Audit
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("SYSTEM_SEED")
                .updatedBy("SYSTEM_SEED")
                .version(1L)

                .addresses(List.of(home))
                .build();
    }

    // ── Organization ──────────────────────────────────────────────────────────

    private Party buildOrganization() {
        String goldenId = UUID.randomUUID().toString();

        Address hq = Address.builder()
                .addressId(UUID.randomUUID().toString())
                .addressType("HEADQUARTERS")
                .isPrimary(true)
                .isVerified(true)
                .verificationSource("USPS_DPV")
                .line1("One World Trade Center")
                .line2("Suite 4200")
                .city("New York")
                .stateProvince("NY")
                .postalCode("10007")
                .county("New York")
                .country("United States")
                .countryCode("US")
                .latitude(40.7127)
                .longitude(-74.0134)
                .geoAccuracy("ROOFTOP")
                .dpvConfirmation("S")
                .effectiveStartDate(LocalDate.of(2010, 1, 1))
                .sourceSystem("ERP_SAP")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("SYSTEM_SEED")
                .build();

        return Party.builder()
                .globalId(goldenId)
                .goldenRecordId(goldenId)
                .partyType("ORGANIZATION")
                .partySubType("CUSTOMER")
                .status("ACTIVE")

                // Identity
                .organizationName("Nexus Financial Group")
                .legalName("Nexus Financial Group LLC")
                .dbaName("NexusFG")
                .fullName("Nexus Financial Group LLC")

                // Legal / Regulatory identifiers
                .taxId("46-3891204")
                .ein("46-3891204")
                .dunsNumber("12-345-6789")
                .lei("549300X7FTTBAL48V89T")
                .naicsCode("523110")        // Investment Banking & Securities Dealers
                .sicCode("6211")

                // Firmographics
                .numberOfEmployees(4800)
                .annualRevenue(2_450_000_000.0)
                .incorporationDate(LocalDate.of(2003, 9, 22))
                .incorporationCountry("United States")
                .countryOfResidence("United States")
                .language("en")

                // Contact
                .phones(Map.of("MAIN", "+1-212-555-0300", "IR", "+1-212-555-0310"))
                .emails(Map.of("INFO", "info@nexusfg.com", "IR", "investors@nexusfg.com"))
                .websites(Map.of("CORPORATE", "https://www.nexusfg.com"))

                // Source
                .sourceSystem("ERP_SAP")
                .sourceSystemId("SAP-BP-10000042")
                .sourceLastUpdated(LocalDateTime.now().minusDays(1))

                // Golden record metadata
                .isGolden(true)
                .matchScore(1.0)
                .confidenceScore(0.99)
                .dataQualityScore(0.96)
                .completenessScore(0.95)
                .accuracyScore(0.98)
                .survivorshipRuleApplied("MOST_RECENT")

                // Audit
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("SYSTEM_SEED")
                .updatedBy("SYSTEM_SEED")
                .version(1L)

                .addresses(List.of(hq))
                .build();
    }
}

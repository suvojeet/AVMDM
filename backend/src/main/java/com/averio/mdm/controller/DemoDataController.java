package com.averio.mdm.controller;

import com.averio.mdm.domain.entity.Address;
import com.averio.mdm.domain.entity.EmailAddress;
import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.entity.Phone;
import com.averio.mdm.service.PartyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Seeds realistic demo data into Neo4j by calling partyService.ingestParty(),
 * which saves each party and runs the matching engine automatically.
 *
 * Round 1 (base parties) is ingested first so Round 2 (near-duplicates) can
 * match against them, producing steward tasks in the REVIEW zone (0.75–0.95).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/demo")
@RequiredArgsConstructor
@Tag(name = "Demo Data", description = "Seed realistic demo parties and trigger the matching engine")
public class DemoDataController {

    private final PartyService partyService;

    @PostMapping("/seed-parties")
    @Operation(summary = "Seed 16 demo parties — auto-runs matching and creates steward tasks")
    public ResponseEntity<Map<String, Object>> seedParties(@AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "DEMO";

        List<String> created = new ArrayList<>();
        List<String> errors  = new ArrayList<>();

        // Round 1 — base parties (no duplicates yet)
        for (Party p : baseParties()) {
            try {
                Party saved = partyService.ingestParty(p, user);
                created.add(label(p) + "  →  " + saved.getGlobalId());
            } catch (Exception e) {
                log.error("Demo seed failed [{}]: {}", label(p), e.getMessage());
                errors.add(label(p) + ": " + e.getMessage());
            }
        }

        // Round 2 — near-duplicates; each triggers matching against Round 1
        for (Party p : nearDuplicates()) {
            try {
                Party saved = partyService.ingestParty(p, user);
                created.add(label(p) + "  →  " + saved.getGlobalId() + " [near-dup → matching triggered]");
            } catch (Exception e) {
                log.error("Demo seed (near-dup) failed [{}]: {}", label(p), e.getMessage());
                errors.add(label(p) + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("partiesIngested", created.size());
        result.put("message",
                "Parties saved to Neo4j. Matching ran automatically — check the Steward Console for review tasks.");
        result.put("detail", created);
        if (!errors.isEmpty()) result.put("errors", errors);
        return ResponseEntity.ok(result);
    }

    // ── Round 1 — 10 base parties ──────────────────────────────────────────────

    private List<Party> baseParties() {
        return List.of(

            // 1  John Smith (will be matched by Jonathan Smith in Round 2)
            individual("CRM", "02121414", "John", "Smith",
                    LocalDate.of(1975, 3, 15), "CUSTOMER",
                    addr("123 Main St", "New York", "NY", "10001"),
                    phone("2125550101"), email("john.smith@gmail.com")),

            // 2  Sarah Connor (will be matched by Sara K. Connor)
            individual("HR", "HR-SC-001", "Sarah", "Connor",
                    LocalDate.of(1985, 7, 22), "EMPLOYEE",
                    addr("456 Oak Ave", "Los Angeles", "CA", "90001"),
                    phone("3105550202"), email("sconnor@company.com")),

            // 3  William Anderson (will be matched by Bill Anderson)
            individual("KYC", "KYC-WA-001", "William", "Anderson",
                    LocalDate.of(1968, 11, 8), "CUSTOMER",
                    addr("789 Pine Rd", "Chicago", "IL", "60601"),
                    phone("3125550303"), email("william.anderson@business.net")),

            // 4  Apple Inc. (will be deterministic-matched by Apple Incorporated via taxId)
            organization("CRM", "CORP-00412", "Apple Inc.", "Apple Inc.",
                    "94-2404110", "009531141", null,
                    addr("One Apple Park Way", "Cupertino", "CA", "95014")),

            // 5  Goldman Sachs Group Inc. (will be probabilistic-matched by Goldman Sachs & Co.)
            organization("CRM", "CRM-GS-001", "Goldman Sachs Group Inc.", "Goldman Sachs Group, Inc.",
                    "13-4019460", null, "W22LROWP2IHZNBB6K528",
                    addr("200 West St", "New York", "NY", "10282")),

            // 6  Microsoft — distinct, no duplicate
            organization("ERP", "ERP-MS-001", "Microsoft Corporation", "Microsoft Corporation",
                    "91-1144442", "145001003", null,
                    addr("One Microsoft Way", "Redmond", "WA", "98052")),

            // 7  JPMorgan Chase — distinct
            organization("KYC", "KYC-JP-001", "JPMorgan Chase & Co.", "JPMorgan Chase & Co.",
                    "13-2624428", null, null,
                    addr("383 Madison Ave", "New York", "NY", "10179")),

            // 8  BlackRock — distinct
            organization("CRM", "CRM-BR-001", "BlackRock Inc.", "BlackRock, Inc.",
                    "32-0174431", null, null,
                    addr("55 East 52nd St", "New York", "NY", "10055")),

            // 9  Emily Chen — distinct individual
            individual("HR", "HR-EC-001", "Emily", "Chen",
                    LocalDate.of(1992, 4, 15), "EMPLOYEE",
                    addr("101 Market St", "San Francisco", "CA", "94105"),
                    null, email("emily.chen@techco.com")),

            // 10  Robert Davis — distinct individual
            individual("CRM", "CRM-RD-001", "Robert", "Davis",
                    LocalDate.of(1961, 9, 3), "CUSTOMER",
                    addr("4500 Texas Ave", "Houston", "TX", "77002"),
                    phone("7135550404"), null)
        );
    }

    // ── Round 2 — 6 near-duplicates / auto-links ───────────────────────────────

    private List<Party> nearDuplicates() {
        return List.of(

            // 11  Jonathan Smith — same DOB + same phone → ~78% → REVIEW zone
            individual("ERP", "NT023512", "Jonathan", "Smith",
                    LocalDate.of(1975, 3, 15), "CUSTOMER",
                    addr("123 Main Street", "New York", "NY", "10001"),
                    phone("2125550101"), email("jon.smith@gmail.com")),

            // 12  Sara K. Connor — same DOB + same phone → ~82% → REVIEW zone
            individual("CRM", "CRM-SKC-001", "Sara", "Connor",
                    LocalDate.of(1985, 7, 22), "EMPLOYEE",
                    addr("456 Oak Avenue", "Los Angeles", "CA", "90001"),
                    phone("3105550202"), email("s.connor@company.com")),

            // 13  Bill Anderson — nickname of William, same DOB → ~80% → REVIEW zone
            individual("BANK", "BANK-BA-001", "Bill", "Anderson",
                    LocalDate.of(1968, 11, 8), "CUSTOMER",
                    addr("789 Pine Road", "Chicago", "IL", "60601"),
                    phone("3125550303"), null),

            // 14  Apple Incorporated — same taxId + DUNS → deterministic → AUTO-LINK (golden merge)
            organization("ERP", "CORP-00509", "Apple Incorporated", "Apple Incorporated",
                    "94-2404110", "009531141", null,
                    addr("1 Apple Park Way", "Cupertino", "CA", "95014")),

            // 15  Goldman Sachs & Co. LLC — no shared identifier, same address → ~80% → REVIEW zone
            organization("ERP", "ERP-GS-001", "Goldman Sachs & Co. LLC", "Goldman Sachs & Co. LLC",
                    null, null, null,
                    addr("200 West Street", "New York", "NY", "10282")),

            // 16  Amazon.com Inc. — no duplicate exists, just populates party list
            organization("CRM", "CRM-AMZ-001", "Amazon.com Inc.", "Amazon.com, Inc.",
                    "91-1087516", null, null,
                    addr("410 Terry Ave N", "Seattle", "WA", "98109"))
        );
    }

    // ── Builders ───────────────────────────────────────────────────────────────

    private Party individual(String source, String sourceId,
                             String first, String last,
                             LocalDate dob, String subType,
                             Address address, Phone ph, EmailAddress em) {
        return Party.builder()
                .partyType("INDIVIDUAL")
                .partySubType(subType)
                .sourceSystem(source)
                .sourceSystemId(sourceId)
                .firstName(first)
                .lastName(last)
                .fullName(first + " " + last)
                .dateOfBirth(dob)
                .status("ACTIVE")
                .nationality("USA")
                .countryOfResidence("USA")
                .addresses(address != null ? new ArrayList<>(List.of(address)) : new ArrayList<>())
                .phoneNumbers(ph != null ? new ArrayList<>(List.of(ph)) : new ArrayList<>())
                .emailAddresses(em != null ? new ArrayList<>(List.of(em)) : new ArrayList<>())
                .dataQualityScore(0.85 + Math.random() * 0.10)
                .build();
    }

    private Party organization(String source, String sourceId,
                               String orgName, String legalName,
                               String taxId, String duns, String lei,
                               Address address) {
        return Party.builder()
                .partyType("ORGANIZATION")
                .partySubType("CUSTOMER")
                .sourceSystem(source)
                .sourceSystemId(sourceId)
                .organizationName(orgName)
                .legalName(legalName)
                .fullName(orgName)
                .taxId(taxId)
                .dunsNumber(duns)
                .lei(lei)
                .status("ACTIVE")
                .incorporationCountry("USA")
                .addresses(address != null ? new ArrayList<>(List.of(address)) : new ArrayList<>())
                .phoneNumbers(new ArrayList<>())
                .emailAddresses(new ArrayList<>())
                .dataQualityScore(0.80 + Math.random() * 0.15)
                .build();
    }

    private Address addr(String line1, String city, String state, String postal) {
        return Address.builder()
                .addressId(UUID.randomUUID().toString())
                .addressType("PRIMARY").isPrimary(true).isVerified(true)
                .line1(line1).city(city).stateProvince(state)
                .postalCode(postal).country("USA").countryCode("US")
                .createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now())
                .build();
    }

    private Phone phone(String number) {
        return Phone.builder()
                .phoneId(UUID.randomUUID().toString())
                .phoneType("MOBILE").countryDialCode("+1")
                .phoneNumber(number).isPrimary(true).isVerified(true)
                .createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now())
                .build();
    }

    private EmailAddress email(String address) {
        return EmailAddress.builder()
                .emailId(UUID.randomUUID().toString())
                .emailType("PRIMARY").email(address)
                .isPrimary(true).isVerified(true)
                .createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now())
                .build();
    }

    private String label(Party p) {
        if (p.getOrganizationName() != null) return p.getOrganizationName();
        return (p.getFirstName() != null ? p.getFirstName() : "") + " "
             + (p.getLastName()  != null ? p.getLastName()  : "");
    }
}

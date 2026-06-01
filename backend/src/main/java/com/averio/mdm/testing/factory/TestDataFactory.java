package com.averio.mdm.testing.factory;

import com.averio.mdm.domain.entity.Party;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Static utility factory for building test Party objects.
 * All test parties use sourceSystem="TEST_LAB" unless overridden.
 */
public final class TestDataFactory {

    private static final AtomicInteger SEQ = new AtomicInteger(0);

    private TestDataFactory() {}

    /**
     * Build a minimal INDIVIDUAL party for testing.
     */
    public static Party individual(String firstName, String lastName, LocalDate dob,
                                   String taxId, String testRunId) {
        int seq = SEQ.incrementAndGet();
        String globalId = "P-TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String sourceSystemId = "TEST-" + testRunId + "-" + seq;

        return Party.builder()
                .globalId(globalId)
                .partyType("INDIVIDUAL")
                .firstName(firstName)
                .lastName(lastName)
                .fullName(firstName + " " + lastName)
                .dateOfBirth(dob)
                .taxId(taxId)
                .sourceSystem("TEST_LAB")
                .sourceSystemId(sourceSystemId)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("TEST_LAB")
                .version(1L)
                .build();
    }

    /**
     * Build a minimal ORGANIZATION party for testing.
     */
    public static Party organization(String orgName, String taxId, String dunsNumber,
                                     String testRunId) {
        int seq = SEQ.incrementAndGet();
        String globalId = "P-TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String sourceSystemId = "TEST-" + testRunId + "-" + seq;

        return Party.builder()
                .globalId(globalId)
                .partyType("ORGANIZATION")
                .organizationName(orgName)
                .legalName(orgName)
                .fullName(orgName)
                .taxId(taxId)
                .dunsNumber(dunsNumber)
                .sourceSystem("TEST_LAB")
                .sourceSystemId(sourceSystemId)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("TEST_LAB")
                .version(1L)
                .build();
    }

    /**
     * Build an INDIVIDUAL party with a MOBILE phone number.
     */
    public static Party individualWithPhone(String firstName, String lastName,
                                             String phone, String testRunId) {
        Party p = individual(firstName, lastName, null, null, testRunId);
        Map<String, String> phones = new HashMap<>();
        phones.put("MOBILE", phone);
        p.setPhones(phones);
        return p;
    }

    /**
     * Build an INDIVIDUAL party with a PRIMARY email address.
     */
    public static Party individualWithEmail(String firstName, String lastName,
                                             String email, String testRunId) {
        Party p = individual(firstName, lastName, null, null, testRunId);
        Map<String, String> emails = new HashMap<>();
        emails.put("PRIMARY", email);
        p.setEmails(emails);
        return p;
    }
}

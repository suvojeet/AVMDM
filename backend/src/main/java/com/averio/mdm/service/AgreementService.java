package com.averio.mdm.service;

import com.averio.mdm.domain.cosmos.AgreementDoc;
import com.averio.mdm.domain.event.AverioMdmEvent;
import com.averio.mdm.repository.cosmos.AgreementDocRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgreementService {

    private final AgreementDocRepository   repo;
    private final ApplicationEventPublisher eventPublisher;

    public List<AgreementDoc> getAll() {
        List<AgreementDoc> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all;
    }

    public List<AgreementDoc> search(String q) {
        List<AgreementDoc> all = getAll();
        if (q == null || q.isBlank()) return all;
        String lc = q.toLowerCase();
        return all.stream()
                .filter(a -> (a.getAgreementNumber() != null && a.getAgreementNumber().toLowerCase().contains(lc))
                        || (a.getAgreementName() != null && a.getAgreementName().toLowerCase().contains(lc))
                        || (a.getAgreementType() != null && a.getAgreementType().toLowerCase().contains(lc))
                        || (a.getPrimaryPartyName() != null && a.getPrimaryPartyName().toLowerCase().contains(lc))
                        || (a.getCounterPartyName() != null && a.getCounterPartyName().toLowerCase().contains(lc)))
                .toList();
    }

    public Optional<AgreementDoc> getById(String id) {
        return repo.findById(id);
    }

    public List<AgreementDoc> getByPartyId(String partyId) {
        List<AgreementDoc> primary = repo.findByPrimaryPartyId(partyId);
        List<AgreementDoc> counter = repo.findByCounterPartyId(partyId);
        return Stream.concat(primary.stream(), counter.stream()).distinct().toList();
    }

    public AgreementDoc create(AgreementDoc agreement) {
        if (agreement.getId() == null || agreement.getId().isBlank()) {
            agreement.setId(UUID.randomUUID().toString());
        }
        if (agreement.getGlobalAgreementId() == null) agreement.setGlobalAgreementId(agreement.getId());
        if (agreement.getAgreementType() == null) agreement.setAgreementType("CONTRACT");
        if (agreement.getAgreementStatus() == null) agreement.setAgreementStatus("DRAFT");
        agreement.setCreatedAt(LocalDateTime.now());
        agreement.setUpdatedAt(LocalDateTime.now());
        agreement.setIsGolden(true);
        agreement.setVersion(1L);
        AgreementDoc saved = repo.save(agreement);
        publishEvent(AverioMdmEvent.AGREEMENT_CREATED, saved.getGlobalAgreementId(), saved);
        return saved;
    }

    public AgreementDoc update(String id, AgreementDoc updates) {
        AgreementDoc existing = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Agreement not found: " + id));
        if (updates.getAgreementStatus() != null) existing.setAgreementStatus(updates.getAgreementStatus());
        if (updates.getAgreementName() != null) existing.setAgreementName(updates.getAgreementName());
        if (updates.getContractValue() != null) existing.setContractValue(updates.getContractValue());
        if (updates.getEffectiveEndDate() != null) existing.setEffectiveEndDate(updates.getEffectiveEndDate());
        if (updates.getAttributes() != null) existing.setAttributes(updates.getAttributes());
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setVersion(existing.getVersion() == null ? 1L : existing.getVersion() + 1);
        AgreementDoc saved = repo.save(existing);
        publishEvent(AverioMdmEvent.AGREEMENT_UPDATED, saved.getGlobalAgreementId(), saved);
        return saved;
    }

    public void delete(String id) {
        repo.deleteById(id);
    }

    private void publishEvent(String type, String entityId, Object entity) {
        try {
            eventPublisher.publishEvent(AverioMdmEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .eventType(type).domain("AGREEMENT")
                    .entityId(entityId).tenantId("default")
                    .entity(entity).timestamp(Instant.now()).build());
        } catch (Exception e) {
            log.warn("Failed to publish {} event for agreement {}: {}", type, entityId, e.getMessage());
        }
    }
}

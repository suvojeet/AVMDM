package com.averio.mdm.service;

import com.averio.mdm.domain.cosmos.AccountDoc;
import com.averio.mdm.domain.event.AverioMdmEvent;
import com.averio.mdm.repository.cosmos.AccountDocRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;


@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountDocRepository  repo;
    private final ApplicationEventPublisher eventPublisher;

    public List<AccountDoc> getAll() {
        List<AccountDoc> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all;
    }

    public List<AccountDoc> search(String q) {
        List<AccountDoc> all = getAll();
        if (q == null || q.isBlank()) return all;
        String lc = q.toLowerCase();
        return all.stream()
                .filter(a -> (a.getAccountNumber() != null && a.getAccountNumber().toLowerCase().contains(lc))
                        || (a.getPrimaryPartyName() != null && a.getPrimaryPartyName().toLowerCase().contains(lc))
                        || (a.getAccountType() != null && a.getAccountType().toLowerCase().contains(lc))
                        || (a.getProductName() != null && a.getProductName().toLowerCase().contains(lc)))
                .toList();
    }

    public Optional<AccountDoc> getById(String id) {
        return repo.findById(id);
    }

    public List<AccountDoc> getByPartyId(String partyId) {
        return repo.findByPrimaryPartyId(partyId);
    }

    public AccountDoc create(AccountDoc account) {
        if (account.getId() == null || account.getId().isBlank()) {
            account.setId(UUID.randomUUID().toString());
        }
        if (account.getGlobalAccountId() == null) account.setGlobalAccountId(account.getId());
        if (account.getAccountType() == null) account.setAccountType("CURRENT");
        if (account.getAccountStatus() == null) account.setAccountStatus("ACTIVE");
        account.setCreatedAt(LocalDateTime.now());
        account.setUpdatedAt(LocalDateTime.now());
        account.setIsGolden(true);
        account.setVersion(1L);
        AccountDoc saved = repo.save(account);
        publishEvent(AverioMdmEvent.ACCOUNT_CREATED, saved.getGlobalAccountId(), saved);
        return saved;
    }

    public AccountDoc update(String id, AccountDoc updates) {
        AccountDoc existing = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + id));
        if (updates.getAccountStatus() != null) existing.setAccountStatus(updates.getAccountStatus());
        if (updates.getCurrentBalance() != null) existing.setCurrentBalance(updates.getCurrentBalance());
        if (updates.getAvailableBalance() != null) existing.setAvailableBalance(updates.getAvailableBalance());
        if (updates.getProductName() != null) existing.setProductName(updates.getProductName());
        if (updates.getAttributes() != null) existing.setAttributes(updates.getAttributes());
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setVersion(existing.getVersion() == null ? 1L : existing.getVersion() + 1);
        AccountDoc saved = repo.save(existing);
        publishEvent(AverioMdmEvent.ACCOUNT_UPDATED, saved.getGlobalAccountId(), saved);
        return saved;
    }

    public void delete(String id) {
        repo.deleteById(id);
    }

    private void publishEvent(String type, String entityId, Object entity) {
        try {
            eventPublisher.publishEvent(AverioMdmEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .eventType(type).domain("ACCOUNT")
                    .entityId(entityId).tenantId("default")
                    .entity(entity).timestamp(Instant.now()).build());
        } catch (Exception e) {
            log.warn("Failed to publish {} event for account {}: {}", type, entityId, e.getMessage());
        }
    }
}

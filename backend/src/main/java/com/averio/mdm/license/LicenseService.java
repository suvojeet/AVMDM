package com.averio.mdm.license;

import com.averio.mdm.license.LicenseTier.Module;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class LicenseService {

    @Value("${averio.license.tier:FULL}")
    private String configuredTier;

    @Value("${averio.ai.agent.enabled:true}")
    private boolean aiAgentEnabled;

    @Value("${averio.ai.agent.provider:ANTHROPIC}")
    private String aiAgentProvider;

    private volatile LicenseTier cached;

    public LicenseTier getTier() {
        if (cached == null) {
            try {
                cached = LicenseTier.valueOf(configuredTier.toUpperCase().trim());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown license tier '{}', defaulting to FULL", configuredTier);
                cached = LicenseTier.FULL;
            }
            log.info("Averio MDM running under license: {}", cached.getDisplayName());
        }
        return cached;
    }

    public boolean isModuleEnabled(Module module) {
        return getTier().includes(module);
    }

    public LicenseInfo getLicenseInfo() {
        LicenseTier tier = getTier();

        List<ModuleStatus> modules = Arrays.stream(Module.values())
                .map(m -> new ModuleStatus(
                        m.name(),
                        m.getDisplayName(),
                        tier.includes(m),
                        LicenseTier.requiredTierFor(m).name()
                ))
                .collect(Collectors.toList());

        List<TierSummary> tiers = Arrays.stream(LicenseTier.values())
                .map(t -> new TierSummary(
                        t.name(),
                        t.getDisplayName(),
                        t.getDescription(),
                        t.getAllowedModules().stream().map(Module::name).sorted().collect(Collectors.toList()),
                        t == tier
                ))
                .collect(Collectors.toList());

        return new LicenseInfo(
                tier.name(),
                tier.getDisplayName(),
                tier.getDescription(),
                modules,
                tiers,
                aiAgentEnabled,
                aiAgentProvider.toUpperCase()
        );
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record LicenseInfo(
            String tier,
            String displayName,
            String description,
            List<ModuleStatus> modules,
            List<TierSummary> tiers,
            boolean aiAgentEnabled,
            String aiProvider
    ) {}

    public record ModuleStatus(
            String module,
            String displayName,
            boolean enabled,
            String requiredTier
    ) {}

    public record TierSummary(
            String tier,
            String displayName,
            String description,
            List<String> modules,
            boolean current
    ) {}
}

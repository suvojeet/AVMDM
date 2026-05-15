package com.averio.mdm.license;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/license")
@RequiredArgsConstructor
@Tag(name = "License", description = "License tier and module entitlement information")
public class LicenseController {

    private final LicenseService licenseService;

    @GetMapping
    @Operation(summary = "Get current license tier and enabled modules")
    public ResponseEntity<LicenseService.LicenseInfo> getLicenseInfo() {
        return ResponseEntity.ok(licenseService.getLicenseInfo());
    }

    @GetMapping("/check/{module}")
    @Operation(summary = "Check whether a specific module is enabled under the current license")
    public ResponseEntity<ModuleCheckResponse> checkModule(@PathVariable String module) {
        try {
            LicenseTier.Module mod = LicenseTier.Module.valueOf(module.toUpperCase());
            boolean enabled = licenseService.isModuleEnabled(mod);
            String requiredTier = LicenseTier.requiredTierFor(mod).name();
            return ResponseEntity.ok(new ModuleCheckResponse(module.toUpperCase(), enabled, requiredTier));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    record ModuleCheckResponse(String module, boolean enabled, String requiredTier) {}
}

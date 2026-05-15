package com.averio.mdm.license;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;

/**
 * Enforces license-tier access control at the HTTP layer.
 * Requests to module API paths that are not included in the configured tier
 * receive HTTP 403 with a JSON body describing the required upgrade.
 */
@Slf4j
@RequiredArgsConstructor
public class LicenseInterceptor implements HandlerInterceptor {

    private final LicenseService licenseService;
    private final ObjectMapper   objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String path   = request.getRequestURI();
        String method = request.getMethod();

        // Only gate mutating + read requests on module paths; skip OPTIONS (CORS pre-flight)
        if ("OPTIONS".equalsIgnoreCase(method)) return true;

        LicenseTier.Module module = LicenseTier.Module.fromPath(path);
        if (module == null) return true; // platform path — always allowed

        if (licenseService.isModuleEnabled(module)) return true;

        LicenseTier current  = licenseService.getTier();
        LicenseTier required = LicenseTier.requiredTierFor(module);

        log.warn("License gate blocked {} {} — module={} currentTier={} requiredTier={}",
                method, path, module, current, required);

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                "error",        "MODULE_NOT_LICENSED",
                "message",      module.getDisplayName() + " is not included in your " + current.getDisplayName() + ".",
                "module",       module.name(),
                "currentTier",  current.name(),
                "requiredTier", required.name(),
                "upgradeInfo",  "Contact sales@averiomdm.org to upgrade to " + required.getDisplayName()
        )));
        return false;
    }
}

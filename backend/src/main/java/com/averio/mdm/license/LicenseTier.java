package com.averio.mdm.license;

import java.util.EnumSet;
import java.util.Set;

/**
 * Defines the three commercial license tiers for Averio MDM.
 *
 * Standard  — Party, Account, Relationship
 * Advanced  — Party, Account, Relationship, Agreement
 * Full      — Party, Account, Relationship, Agreement, Product
 */
public enum LicenseTier {

    STANDARD("Standard Edition", "Core party and account mastering for enterprise MDM."),
    ADVANCED("Advanced Edition", "Extended MDM with agreement lifecycle management."),
    FULL    ("Full Edition",     "Complete MDM platform including full product master.");

    private final String displayName;
    private final String description;

    LicenseTier(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription()  { return description; }

    /** Returns the set of data-domain modules available under this tier. */
    public Set<Module> getAllowedModules() {
        return switch (this) {
            case STANDARD -> EnumSet.of(Module.PARTY, Module.ACCOUNT, Module.RELATIONSHIP);
            case ADVANCED -> EnumSet.of(Module.PARTY, Module.ACCOUNT, Module.RELATIONSHIP, Module.AGREEMENT);
            case FULL     -> EnumSet.allOf(Module.class);
        };
    }

    public boolean includes(Module module) {
        return getAllowedModules().contains(module);
    }

    /** Returns the minimum tier required for the given module. */
    public static LicenseTier requiredTierFor(Module module) {
        return switch (module) {
            case PARTY, ACCOUNT, RELATIONSHIP -> STANDARD;
            case AGREEMENT                    -> ADVANCED;
            case PRODUCT                      -> FULL;
        };
    }

    // ── Data-domain modules ────────────────────────────────────────────────────

    public enum Module {
        PARTY       ("Party Master",        "party"),
        ACCOUNT     ("Account Master",      "account"),
        RELATIONSHIP("Relationship Graph",  "relationship"),
        AGREEMENT   ("Agreement Master",    "agreement"),
        PRODUCT     ("Product Master",      "product");

        private final String displayName;
        private final String apiPrefix;   // matches /api/v1/<apiPrefix>

        Module(String displayName, String apiPrefix) {
            this.displayName = displayName;
            this.apiPrefix   = apiPrefix;
        }

        public String getDisplayName() { return displayName; }
        public String getApiPrefix()   { return apiPrefix; }

        /** Resolves a request URI path to a Module, or null if it's a platform path. */
        public static Module fromPath(String path) {
            if (path.startsWith("/api/v1/products"))      return PRODUCT;
            if (path.startsWith("/api/v1/agreements"))    return AGREEMENT;
            if (path.startsWith("/api/v1/parties"))       return PARTY;
            if (path.startsWith("/api/v1/accounts"))      return ACCOUNT;
            if (path.startsWith("/api/v1/relationships")) return RELATIONSHIP;
            return null; // platform path — not module-gated
        }
    }
}

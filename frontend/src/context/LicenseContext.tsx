import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { licenseApi } from "../services/api";

// ── Types ──────────────────────────────────────────────────────────────────

export type Tier = "STANDARD" | "ADVANCED" | "FULL";
export type Module = "PARTY" | "ACCOUNT" | "RELATIONSHIP" | "AGREEMENT" | "PRODUCT";

export interface ModuleStatus {
  module: Module;
  displayName: string;
  enabled: boolean;
  requiredTier: Tier;
}

export interface TierSummary {
  tier: Tier;
  displayName: string;
  description: string;
  modules: Module[];
  current: boolean;
}

export interface LicenseInfo {
  tier: Tier;
  displayName: string;
  description: string;
  modules: ModuleStatus[];
  tiers: TierSummary[];
  aiAgentEnabled: boolean;
  aiProvider: string;       // "ANTHROPIC" | "AZURE_OPENAI"
}

interface LicenseContextValue {
  license: LicenseInfo;
  hasModule: (module: Module) => boolean;
  hasAiAgent: () => boolean;
  isLoading: boolean;
}

// ── Defaults (shown during loading — assume FULL so nothing flickers hidden) ──

const DEFAULT_LICENSE: LicenseInfo = {
  tier: "FULL",
  displayName: "Full Edition",
  description: "",
  modules: [],
  tiers: [],
  aiAgentEnabled: true,
  aiProvider: "ANTHROPIC",
};

const TIER_ORDER: Record<Tier, number> = { STANDARD: 0, ADVANCED: 1, FULL: 2 };

// ── Context ────────────────────────────────────────────────────────────────

const LicenseContext = createContext<LicenseContextValue>({
  license: DEFAULT_LICENSE,
  hasModule: () => true,
  hasAiAgent: () => true,
  isLoading: true,
});

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<LicenseInfo>({
    queryKey: ["license"],
    queryFn:  licenseApi.getInfo,
    staleTime: Infinity,      // license doesn't change at runtime
    retry: 1,
  });

  const license = data ?? DEFAULT_LICENSE;

  const hasModule = (module: Module): boolean => {
    if (!data) return true; // optimistic while loading
    return license.modules.find((m) => m.module === module)?.enabled ?? false;
  };

  const hasAiAgent = (): boolean => {
    if (!data) return true; // optimistic while loading
    return license.aiAgentEnabled ?? true;
  };

  return (
    <LicenseContext.Provider value={{ license, hasModule, hasAiAgent, isLoading }}>
      {children}
    </LicenseContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useLicense() {
  return useContext(LicenseContext);
}

/** Returns the required tier display name for a module. */
export function requiredTierLabel(module: Module, tiers: TierSummary[]): string {
  const tier = tiers.find((t) => t.modules.includes(module));
  return tier?.displayName ?? "upgrade";
}

/** True if tierA is higher (more features) than tierB. */
export function tierIsHigher(a: Tier, b: Tier): boolean {
  return TIER_ORDER[a] > TIER_ORDER[b];
}

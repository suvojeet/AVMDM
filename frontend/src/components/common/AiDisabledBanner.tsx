import { BotOff, ExternalLink } from "lucide-react";

/**
 * Shown instead of AI feature content when the AI Agent module is not licensed
 * or when it has been administratively disabled (AI_AGENT_ENABLED=false).
 */
export default function AiDisabledBanner({ feature = "AI Agent" }: { feature?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-5 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20
                      flex items-center justify-center">
        <BotOff size={28} className="text-slate-500" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-lg font-semibold text-aq-text">{feature} Not Available</h2>
        <p className="text-sm text-aq-dim leading-relaxed">
          The AI Agent module is not enabled on this license.
          Contact your administrator or upgrade your Averio MDM subscription to activate AI capabilities.
        </p>
      </div>
      <div className="flex flex-col gap-2 text-xs text-aq-dim max-w-xs">
        <div className="px-4 py-2.5 bg-aq-dark border border-aq-border rounded-xl text-left space-y-1">
          <p className="font-semibold text-aq-text">Supported AI Providers</p>
          <p>• <span className="text-aq-blue-2">Anthropic Claude</span> — default, via API key</p>
          <p>• <span className="text-purple-400">Azure OpenAI</span> — enterprise license, self-hosted</p>
        </div>
        <p className="text-aq-dim/60">
          Set <code className="font-mono text-aq-blue-2">AI_AGENT_ENABLED=true</code> and configure
          a provider to enable AI features.
        </p>
      </div>
    </div>
  );
}

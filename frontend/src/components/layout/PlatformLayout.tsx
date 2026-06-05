import { Outlet } from "react-router-dom";
import PlatformSidebar from "./PlatformSidebar";
import { ShieldAlert } from "lucide-react";

export default function PlatformLayout() {
  return (
    <div className="flex h-screen bg-aq-dark overflow-hidden">
      <PlatformSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Internal-only top banner */}
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 py-1.5 flex-shrink-0">
          <ShieldAlert size={12} className="text-amber-400" />
          <p className="text-[11px] font-semibold text-amber-400 tracking-wide">
            AVERIO INTERNAL — Control Plane access is restricted to authorised Averio employees only.
            Client accounts cannot reach this section.
          </p>
        </div>
        <main className="flex-1 overflow-y-auto p-6 bg-aq-dark">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

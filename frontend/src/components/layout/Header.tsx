import { Bell, Search, Activity, LogOut, ChevronDown, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/nlp-search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 bg-aq-card border-b border-aq-border flex items-center justify-between px-6 z-10 flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
          <input
            type="text"
            placeholder="Ask anything about your data... (AI Search)"
            className="w-full pl-9 pr-4 py-2 bg-aq-dark border border-aq-border rounded-lg text-sm
                       text-aq-text placeholder-aq-dim focus:outline-none focus:ring-1 focus:ring-aq-blue
                       focus:border-aq-blue transition-all duration-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        <button
          onClick={() => navigate("/nlp-search")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-aq-blue
                     bg-aq-blue/10 border border-aq-blue/25 hover:bg-aq-blue/20 transition-all duration-150 whitespace-nowrap"
        >
          <Sparkles size={13} />
          AI Search
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* System status */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Activity size={11} className="text-emerald-400 animate-pulse-slow" />
          <span className="text-xs text-emerald-400 font-medium">Operational</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-aq-muted hover:text-aq-text hover:bg-aq-border/50 transition-colors">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
        </button>

        {/* User menu */}
        <div className="relative pl-3 border-l border-aq-border" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white
                            bg-gradient-to-br from-aq-blue to-aq-purple">
              {user?.avatarInitials ?? "?"}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm text-aq-text font-medium leading-tight">{user?.displayName ?? "Guest"}</p>
              <p className="text-xs text-aq-muted leading-tight capitalize">{user?.role?.toLowerCase() ?? ""}</p>
            </div>
            <ChevronDown size={14} className={`text-aq-muted transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-aq-card border border-aq-border rounded-xl
                            shadow-lg shadow-black/40 z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-aq-border">
                <p className="text-sm font-semibold text-aq-text">{user?.displayName}</p>
                <p className="text-xs text-aq-muted mt-0.5">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400
                             hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

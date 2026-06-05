import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  username: string;
  role: "ADMIN" | "STEWARD" | "VIEWER" | "TESTER" | "PLATFORM_ADMIN";
  displayName: string;
  email: string;
  avatarInitials: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// Static credentials for demo — replace with real auth in production
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: "admin",
    user: {
      username: "admin",
      role: "ADMIN",
      displayName: "System Administrator",
      email: "admin@averiomdm.org",
      avatarInitials: "SA",
    },
  },
  steward: {
    password: "steward123",
    user: {
      username: "steward",
      role: "STEWARD",
      displayName: "Data Steward",
      email: "steward@averiomdm.org",
      avatarInitials: "DS",
    },
  },
  tester: {
    password: "tester123",
    user: {
      username: "tester",
      role: "TESTER",
      displayName: "QA Engineer",
      email: "tester@averiomdm.org",
      avatarInitials: "QA",
    },
  },
  // Averio internal — platform control plane access only
  averio: {
    password: "averio2026",
    user: {
      username: "averio",
      role: "PLATFORM_ADMIN",
      displayName: "Averio Platform Admin",
      email: "platform@averio.internal",
      avatarInitials: "AP",
    },
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        await new Promise((r) => setTimeout(r, 800));
        const match = DEMO_USERS[username.toLowerCase()];
        if (match && match.password === password) {
          const fakeToken = btoa(`${username}:${Date.now()}`);
          set({ user: match.user, token: fakeToken, isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: "averio-auth",
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
);

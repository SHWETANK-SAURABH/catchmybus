import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, post, tokenStore } from "./api";
import type { TokenOut, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<User>;
  demoLogin: (role: "COMMUTER" | "ADMIN") => Promise<User>;
  guestLogin: () => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false));
  }, []);

  const accept = useCallback((res: TokenOut) => {
    tokenStore.set(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const value: AuthState = {
    user,
    loading,
    login: (email, password) => post<TokenOut>("/auth/login", { email, password }).then(accept),
    register: (name, email, password, phone) =>
      post<TokenOut>("/auth/register", { name, email, password, phone: phone || null }).then(accept),
    demoLogin: (role) => post<TokenOut>("/auth/demo-login", { role }).then(accept),
    guestLogin: () => post<TokenOut>("/auth/guest").then(accept),
    logout: () => {
      tokenStore.set(null);
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Guests ("Skip sign-in") get a temporary account on this domain. */
export const isGuest = (u: User | null) => !!u?.email.endsWith("@guest.catchmybus.local");

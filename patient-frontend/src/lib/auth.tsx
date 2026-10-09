import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onUnauthorized, STORAGE } from "./api";
import type { Session } from "./types";

interface AuthCtx {
  session: Session | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

/** The auth-service issues a JWT whose subject is the e-mail and which carries a `role` claim. */
function decode(token: string): Session | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { token, email: payload.sub, role: payload.role, expiresAt: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

function load(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE) || "null") as Session | null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(load);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE);
    setSession(null);
  }, []);

  useEffect(() => { onUnauthorized(logout); }, [logout]);

  // sign out automatically when the token expires
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    const t = setTimeout(logout, Math.max(ms, 0));
    return () => clearTimeout(t);
  }, [session, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await api.login(email, password);
    const s = decode(token);
    if (!s) throw new Error("The server returned an unreadable token.");
    localStorage.setItem(STORAGE, JSON.stringify(s));
    setSession(s);
  }, []);

  const value = useMemo<AuthCtx>(() => ({ session, isAdmin: session?.role === "ADMIN", login, logout }), [session, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

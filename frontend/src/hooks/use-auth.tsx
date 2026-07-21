import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { setTenantId, setAuthTokenGetter } from "@workspace/api-client-react";

export type AuthUser = {
  id: number;
  phone: string;
  name: string;
  title?: string | null;
  role: string;
  schoolCode?: string | null;
  tenantId?: number | null;
  photoUrl?: string | null;
  biometricEnabled?: boolean;
  tenant?: { id: number; name: string; bannerUrl?: string | null; address?: string | null; schoolCode?: string | null } | null;
};

const SESSION_KEY = "orbittrack_user";
const TOKEN_KEY = "orbittrack_token";

function readSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const u = raw ? (JSON.parse(raw) as AuthUser) : null;
    if (u?.tenantId) setTenantId(u.tenantId);
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) setAuthTokenGetter(() => token);
    return u;
  } catch {
    return null;
  }
}

function writeSession(user: AuthUser | null, token?: string | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else if (token === null) localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

type AuthCtx = {
  user: AuthUser | null;
  login: (user: AuthUser, token?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readSession());

  const login = useCallback((u: AuthUser, token?: string) => {
    writeSession(u, token);
    setUser(u);
    setTenantId(u.tenantId ?? null);
    if (token) setAuthTokenGetter(() => token);
  }, []);

  const logout = useCallback(() => {
    writeSession(null, null);
    setUser(null);
    setTenantId(null);
    setAuthTokenGetter(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

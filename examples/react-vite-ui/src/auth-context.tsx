import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type DbKey = "postgres" | "mssql" | "sqlite3";

type DbAuthState =
   | { authenticated: false; token: null }
   | { authenticated: true; token: string; userId: string; name: string; roles: string[] };

type AuthContextValue = {
   sessions: Record<DbKey, DbAuthState>;
   login: (db: DbKey, token: string) => void;
   logout: (db: DbKey) => void;
};

const UNAUTHENTICATED: DbAuthState = { authenticated: false, token: null };

const Context = createContext<AuthContextValue | null>(null);

// Minimal JWT payload decoder — no verification, server must verify
function decodeJwtPayload(token: string): { sub?: string; name?: string; roles?: string[] } | null {
   try {
      const payload = token.split(".")[1];
      if (!payload) return null;
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
   } catch {
      return null;
   }
}

const INITIAL: Record<DbKey, DbAuthState> = {
   postgres: UNAUTHENTICATED,
   mssql: UNAUTHENTICATED,
   sqlite3: UNAUTHENTICATED,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
   const [sessions, setSessions] = useState<Record<DbKey, DbAuthState>>(INITIAL);

   const login = useCallback((db: DbKey, token: string) => {
      const payload = decodeJwtPayload(token);
      setSessions((prev) => ({
         ...prev,
         [db]: {
            authenticated: true,
            token,
            userId: payload?.sub ?? "unknown",
            name: payload?.name ?? payload?.sub ?? "unknown",
            roles: payload?.roles ?? [],
         },
      }));
   }, []);

   const logout = useCallback((db: DbKey) => {
      setSessions((prev) => ({ ...prev, [db]: UNAUTHENTICATED }));
   }, []);

   const value = useMemo(() => ({ sessions, login, logout }), [sessions, login, logout]);

   return <Context value={value}>{children}</Context>;
}

export function useAuth(db: DbKey): DbAuthState & { login: (token: string) => void; logout: () => void } {
   const ctx = useContext(Context);
   if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
   const state = ctx.sessions[db];
   const login = useCallback((token: string) => ctx.login(db, token), [ctx, db]);
   const logout = useCallback(() => ctx.logout(db), [ctx, db]);
   return useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
}

export function useAuthSessions(): Record<DbKey, DbAuthState> & { logout: (db: DbKey) => void } {
   const ctx = useContext(Context);
   if (!ctx) throw new Error("useAuthSessions must be used inside <AuthProvider>");
   return useMemo(() => ({ ...ctx.sessions, logout: ctx.logout }), [ctx.sessions, ctx.logout]);
}

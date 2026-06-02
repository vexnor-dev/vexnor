"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type AuthState =
   | { authenticated: false; token: null }
   | { authenticated: true; token: string; userId: string; roles: string[] };

type AuthContext = AuthState & {
   login: (token: string) => void;
   logout: () => void;
};

const Context = createContext<AuthContext | null>(null);

// Minimal JWT payload decoder — no verification, server must verify
function decodeJwtPayload(token: string): { sub?: string; roles?: string[] } | null {
   try {
      const payload = token.split(".")[1];
      if (!payload) return null;
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
   } catch {
      return null;
   }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
   const [state, setState] = useState<AuthState>({ authenticated: false, token: null });

   const login = useCallback((token: string) => {
      const payload = decodeJwtPayload(token);
      setState({
         authenticated: true,
         token,
         userId: payload?.sub ?? "unknown",
         roles: payload?.roles ?? [],
      });
   }, []);

   const logout = useCallback(() => {
      setState({ authenticated: false, token: null });
   }, []);

   const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);

   return <Context value={value}>{children}</Context>;
}

export function useAuth(): AuthContext {
   const ctx = useContext(Context);
   if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
   return ctx;
}

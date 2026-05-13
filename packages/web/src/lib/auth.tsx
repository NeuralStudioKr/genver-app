'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';
import { wsClient } from './ws';

export interface AuthUser {
  id: string;
  displayName: string;
  isBot: boolean;
  avatarUrl: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(u: { id: string; display_name?: string; displayName?: string; type?: string; email?: string }): AuthUser {
  const name = u.display_name || u.displayName || u.email || '?';
  const isBot = u.type ? u.type === 'bot' : false;
  return { id: u.id, displayName: name, isBot, avatarUrl: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    const token = localStorage.getItem('genver_token');
    if (token) {
      api.getCurrentUser()
        .then((raw) => { setState({ user: toAuthUser(raw), token, loading: false }); wsClient.connect(token); })
        .catch(() => { localStorage.removeItem('genver_token'); setState({ user: null, token: null, loading: false }); });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem('genver_token', res.token);
    const u = res.user ? toAuthUser(res.user) : toAuthUser({ id: '', email });
    setState({ user: u, token: res.token, loading: false });
    wsClient.connect(res.token);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.register(email, password, displayName);
    localStorage.setItem('genver_token', res.token);
    const u = res.user ? toAuthUser(res.user) : toAuthUser({ id: '', displayName });
    setState({ user: u, token: res.token, loading: false });
    wsClient.connect(res.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('genver_token');
    wsClient.disconnect();
    setState({ user: null, token: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

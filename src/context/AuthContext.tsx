import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/crm';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await api.getSession();
      setUser(res.user);
      setSessionExpired(false);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();

    const handleExpired = () => {
      setUser(null);
      setSessionExpired(true);
      localStorage.removeItem('emperor_token');
    };

    window.addEventListener('emperor:session-expired', handleExpired);
    return () => window.removeEventListener('emperor:session-expired', handleExpired);
  }, [refreshSession]);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.login(credentials);
    localStorage.setItem('emperor_token', res.token);
    setUser(res.user);
    setSessionExpired(false);
  };

  const register = async (data: any) => {
    const res = await api.register(data);
    localStorage.setItem('emperor_token', res.token);
    setUser(res.user);
    setSessionExpired(false);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('emperor_token');
      setUser(null);
      setSessionExpired(false);
    }
  };

  const dismissSessionExpired = () => {
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        login,
        register,
        logout,
        refreshSession,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

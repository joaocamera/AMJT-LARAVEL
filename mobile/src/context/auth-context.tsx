import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthContextValue = {
  token: string | null;
  loading: boolean;
  login: (newToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = 'amjt_user_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    async function bootstrap() {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (isActive) setToken(stored);
      } finally {
        if (isActive) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(async (newToken: string) => {
    setToken(newToken);
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }, []);

  const value = useMemo(
    () => ({
      token,
      loading,
      login,
      logout
    }),
    [token, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

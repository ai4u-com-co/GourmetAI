import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { setHistoryOwner } from '../utils/historyService';

type AuthValue = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  // El historial local es POR CUENTA: solo se abre cuando hay una persona con acceso confirmado.
  useEffect(() => {
    setHistoryOwner(auth.state === 'ready' ? auth.userId : null);
  }, [auth.state, auth.userId]);
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider');
  return ctx;
};

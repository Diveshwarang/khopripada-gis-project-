import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Role, UserSession, DemoAccount } from '../types/auth';

const STORAGE_KEY = 'smart_village_session';

export const DEMO_ACCOUNTS: Record<Role, DemoAccount> = {
  admin: {
    role: 'admin',
    name: 'Rajesh Patil',
    designation: 'Sarpanch / Panchayat Lead',
    email: 'admin@khopripada.gov.in',
    password: 'admin123',
    badgeLabel: 'Panchayat Admin',
    description: 'Full supervisory authority over village spatial twin, budgets, ML analytics, and master records.',
  },
  officer: {
    role: 'officer',
    name: 'Anand Kadam',
    designation: 'Gram Sevak / Field Inspector',
    email: 'officer@khopripada.gov.in',
    password: 'officer123',
    badgeLabel: 'Field Officer',
    description: 'Ground verification, facility registration, grievance status transitions & field inspections.',
  },
  user: {
    role: 'user',
    name: 'Santosh Vartak',
    designation: 'Khopripada Resident',
    email: 'citizen@khopripada.in',
    password: 'user123',
    badgeLabel: 'Villager Portal',
    description: 'Village asset exploration, GPS location tracking, and community grievance submission.',
  },
};

interface AuthContextType {
  session: UserSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemoRole: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: UserSession = JSON.parse(stored);
        if (parsed && parsed.role && parsed.id) {
          setSession(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to parse stored session from localStorage:', err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistSession = (newSession: UserSession | null) => {
    setSession(newSession);
    if (newSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Check against demo accounts
    const matchedAccount = Object.values(DEMO_ACCOUNTS).find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );

    if (!matchedAccount) {
      return {
        success: false,
        error: 'Invalid credentials. Please use an authorized village email address or 1-Click Demo.',
      };
    }

    if (matchedAccount.password !== cleanPassword) {
      return {
        success: false,
        error: 'Incorrect password for this village portal account.',
      };
    }

    const userSession: UserSession = {
      id: `usr_${matchedAccount.role}_${Date.now()}`,
      name: matchedAccount.name,
      email: matchedAccount.email,
      role: matchedAccount.role,
      designation: matchedAccount.designation,
      token: `tok_sim_${matchedAccount.role}_${Math.random().toString(36).substring(2, 10)}`,
      loginTime: new Date().toISOString(),
    };

    persistSession(userSession);
    return { success: true };
  };

  const loginAsDemoRole = (role: Role) => {
    const account = DEMO_ACCOUNTS[role];
    const userSession: UserSession = {
      id: `usr_${role}_${Date.now()}`,
      name: account.name,
      email: account.email,
      role: account.role,
      designation: account.designation,
      token: `tok_sim_${role}_${Math.random().toString(36).substring(2, 10)}`,
      loginTime: new Date().toISOString(),
    };
    persistSession(userSession);
  };

  const logout = () => {
    persistSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        login,
        loginAsDemoRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

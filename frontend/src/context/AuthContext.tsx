import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (googleToken: string) => Promise<void>;
  loginWithGitHub: (code: string, redirectUri: string) => Promise<void>;
  logout: () => void;
  getAuthToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token and validate it
    const initAuth = async () => {
      const token = authService.getToken();
      if (token) {
        try {
          const userData = await authService.getCurrentUser(token);
          setUser(userData);
        } catch (error) {
          // Token is invalid, remove it
          authService.removeToken();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const loginWithGoogle = async (googleToken: string) => {
    try {
      const response = await authService.loginWithGoogle(googleToken);
      authService.setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    }
  };

  const loginWithGitHub = async (code: string, redirectUri: string) => {
    try {
      const response = await authService.loginWithGitHub(code, redirectUri);
      authService.setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      console.error('GitHub login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    authService.removeToken();

    // Also logout from Google
    if (typeof window.google !== 'undefined' && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const getAuthToken = () => {
    return authService.getToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithGoogle,
        loginWithGitHub,
        logout,
        getAuthToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Type declarations for global window object
declare global {
  interface Window {
    google: any;
  }
}

export default AuthContext;

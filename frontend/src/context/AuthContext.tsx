import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'email';
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (userInfo: UserInfo) => void;
  loginWithEmail: (email: string, password: string) => boolean;
  registerWithEmail: (name: string, email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Simple hash function for demo purposes (in production, use bcrypt on backend)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const savedUser = localStorage.getItem('famm_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('famm_user');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = (userInfo: UserInfo) => {
    const newUser: User = {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      avatar: userInfo.avatar,
      provider: 'google',
    };
    setUser(newUser);
    localStorage.setItem('famm_user', JSON.stringify(newUser));
  };

  const loginWithEmail = (email: string, password: string): boolean => {
    // Get registered users from localStorage
    const usersJson = localStorage.getItem('famm_registered_users');
    const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];
    
    // Find user by email
    const storedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!storedUser) {
      return false;
    }
    
    // Check password
    if (storedUser.passwordHash !== simpleHash(password)) {
      return false;
    }
    
    // Login successful
    const newUser: User = {
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      provider: 'email',
    };
    setUser(newUser);
    localStorage.setItem('famm_user', JSON.stringify(newUser));
    return true;
  };

  const registerWithEmail = (name: string, email: string, password: string): boolean => {
    // Get existing users
    const usersJson = localStorage.getItem('famm_registered_users');
    const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];
    
    // Check if email already exists
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return false;
    }
    
    // Create new user
    const newStoredUser: StoredUser = {
      id: `email_${Date.now()}`,
      name,
      email,
      passwordHash: simpleHash(password),
    };
    
    // Save to registered users
    users.push(newStoredUser);
    localStorage.setItem('famm_registered_users', JSON.stringify(users));
    
    // Login the new user
    const newUser: User = {
      id: newStoredUser.id,
      name: newStoredUser.name,
      email: newStoredUser.email,
      provider: 'email',
    };
    setUser(newUser);
    localStorage.setItem('famm_user', JSON.stringify(newUser));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('famm_user');
    
    // Also logout from Google
    if (typeof window.google !== 'undefined' && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
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

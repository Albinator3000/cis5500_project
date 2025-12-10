import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'github';
  username?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authService = {
  /**
   * Authenticate with Google OAuth
   */
  async loginWithGoogle(googleToken: string): Promise<AuthResponse> {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/google`, {
      token: googleToken,
    });
    return response.data;
  },

  /**
   * Authenticate with GitHub OAuth
   */
  async loginWithGitHub(code: string, redirectUri: string): Promise<AuthResponse> {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/github`, {
      code,
      redirect_uri: redirectUri,
    });
    return response.data;
  },

  /**
   * Get current user from token
   */
  async getCurrentUser(token: string): Promise<User> {
    const response = await axios.get<{ user: User }>(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.user;
  },

  /**
   * Store auth token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  },

  /**
   * Get auth token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  /**
   * Remove auth token from localStorage
   */
  removeToken(): void {
    localStorage.removeItem('auth_token');
  },
};

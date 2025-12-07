import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

// Decode JWT token to get user info
const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return null;
  }
};

const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Handle Google login success
  const handleGoogleSuccess = (credentialResponse: CredentialResponse) => {
    setError(null);
    if (credentialResponse.credential) {
      const decoded = decodeJwt(credentialResponse.credential);
      if (decoded) {
        loginWithGoogle({
          id: decoded.sub,
          name: decoded.name,
          email: decoded.email,
          avatar: decoded.picture,
        });
      }
    }
  };

  // Handle Google login error
  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  // Handle email/password form submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFormLoading(true);

    try {
      if (activeTab === 'register') {
        if (!name.trim()) {
          setError('Please enter your name.');
          setFormLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setFormLoading(false);
          return;
        }
        const success = registerWithEmail(name, email, password);
        if (!success) {
          setError('An account with this email already exists.');
        }
      } else {
        const success = loginWithEmail(email, password);
        if (!success) {
          setError('Invalid email or password.');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  // Redirect if already authenticated
  if (isAuthenticated && !isLoading) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-container">
      <div className="login-card animate-slide-up">
        <div className="login-header">
          <div className="login-logo">FA</div>
          <h1 className="login-title">Welcome to FundingAware</h1>
          <p className="login-subtitle">
            Sign in to access your market analysis dashboard
          </p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-md)',
            background: 'var(--accent-danger-dim)',
            border: '1px solid var(--accent-danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-danger)',
            fontSize: '0.875rem',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Google Login */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: 'var(--space-xl)'
        }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            size="large"
            width="352"
            text="continue_with"
            shape="rectangular"
          />
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
          color: 'var(--text-muted)',
          fontSize: '0.8rem'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
          <span>or continue with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-lg)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: '4px'
        }}>
          <button
            onClick={() => { setActiveTab('signin'); setError(null); }}
            style={{
              flex: 1,
              padding: 'var(--space-sm) var(--space-md)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'signin' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'signin' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(null); }}
            style={{
              flex: 1,
              padding: 'var(--space-sm) var(--space-md)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'register' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            Register
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {activeTab === 'register' && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required={activeTab === 'register'}
                style={{
                  width: '100%',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          )}
          
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: 'var(--space-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={{
                width: '100%',
                padding: 'var(--space-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={formLoading}
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: 'var(--space-sm)',
              padding: 'var(--space-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-sm)'
            }}
          >
            {formLoading ? (
              <>
                <div className="loading-spinner" />
                {activeTab === 'register' ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              activeTab === 'register' ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <div style={{
          marginTop: 'var(--space-xl)',
          paddingTop: 'var(--space-lg)',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center'
        }}>
          <p style={{ 
            color: 'var(--text-muted)', 
            fontSize: '0.8rem',
            lineHeight: 1.5
          }}>
            Crypto funding rate analysis & market intelligence
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

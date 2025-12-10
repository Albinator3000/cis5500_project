import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = import.meta.env.VITE_GITHUB_REDIRECT_URI || 'http://localhost:5173/login';

const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithGitHub, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Handle GitHub OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleGitHubCallback(code);
    }
  }, [searchParams]);

  const handleGitHubCallback = async (code: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await loginWithGitHub(code, GITHUB_REDIRECT_URI);
      // Clear the code from URL
      navigate('/login', { replace: true });
    } catch (err) {
      setError('GitHub sign-in failed. Please try again.');
      console.error('GitHub login error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Google login success
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    setAuthLoading(true);
    if (credentialResponse.credential) {
      try {
        await loginWithGoogle(credentialResponse.credential);
      } catch (err) {
        setError('Google sign-in failed. Please try again.');
        console.error('Google login error:', err);
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // Handle Google login error
  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  // Handle GitHub login
  const handleGitHubLogin = () => {
    if (!GITHUB_CLIENT_ID) {
      setError('GitHub OAuth is not configured.');
      return;
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=read:user user:email`;
    window.location.href = githubAuthUrl;
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

        {authLoading && (
          <div style={{
            padding: 'var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-md)'
          }}>
            <div className="loading-spinner" style={{ width: 40, height: 40 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Signing you in...
            </p>
          </div>
        )}

        {!authLoading && (
          <>
            {/* Google Login */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 'var(--space-md)'
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

            {/* GitHub Login */}
            <button
              onClick={handleGitHubLogin}
              className="btn"
              style={{
                width: '100%',
                padding: 'var(--space-md)',
                background: '#24292e',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                transition: 'background var(--transition-fast)',
                marginBottom: 'var(--space-xl)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a1e22'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#24292e'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
          </>
        )}

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

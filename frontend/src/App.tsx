import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import EventStudyPage from './pages/EventStudyPage';
import FundingDecilesPage from './pages/FundingDecilesPage';
import ExtremeRegimesPage from './pages/ExtremeRegimesPage';
import HourlyAnalysisPage from './pages/HourlyAnalysisPage';
import VolatilityRegimesPage from './pages/VolatilityRegimesPage';
import SymbolDashboardPage from './pages/SymbolDashboardPage';
import LeaderboardsPage from './pages/LeaderboardsPage';
import QueryPerformancePage from './pages/QueryPerformancePage';
import './styles.css';

// Icons as SVG components
const ChartIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const DecileIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"></path>
    <path d="M18 17V9"></path>
    <path d="M13 17V5"></path>
    <path d="M8 17v-3"></path>
  </svg>
);

const BoltIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
  </svg>
);

const ClockIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const ActivityIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
  </svg>
);

const DatabaseIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
);

const TrophyIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
  </svg>
);

const SpeedometerIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const LogoutIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh' 
      }}>
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Main Layout with Sidebar
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">FA</div>
            <div className="logo-text">
              Funding<span>Aware</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Analysis</div>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ChartIcon />
            <span>Event Study</span>
          </NavLink>
          <NavLink to="/deciles" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <DecileIcon />
            <span>Funding Deciles</span>
          </NavLink>
          <NavLink to="/extreme" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BoltIcon />
            <span>Extreme Regimes</span>
          </NavLink>
          <NavLink to="/hourly" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ClockIcon />
            <span>Hourly Analysis</span>
          </NavLink>
          <NavLink to="/volatility" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ActivityIcon />
            <span>Vol Regimes</span>
          </NavLink>
          <NavLink to="/leaderboards" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <TrophyIcon />
            <span>Leaderboards</span>
          </NavLink>
          
          <div className="nav-section-label">Data</div>
          <NavLink to="/symbols" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <DatabaseIcon />
            <span>Symbol Dashboard</span>
          </NavLink>
          <NavLink to="/performance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <SpeedometerIcon />
            <span>Query Performance</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge" onClick={handleLogout} title="Click to logout">
            <div className="user-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                getInitials(user?.name || 'U')
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-email">{user?.email || ''}</div>
            </div>
            <LogoutIcon />
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

// App Routes
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <EventStudyPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deciles"
        element={
          <ProtectedRoute>
            <MainLayout>
              <FundingDecilesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/extreme"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ExtremeRegimesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hourly"
        element={
          <ProtectedRoute>
            <MainLayout>
              <HourlyAnalysisPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/volatility"
        element={
          <ProtectedRoute>
            <MainLayout>
              <VolatilityRegimesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/symbols"
        element={
          <ProtectedRoute>
            <MainLayout>
              <SymbolDashboardPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboards"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LeaderboardsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/performance"
        element={
          <ProtectedRoute>
            <MainLayout>
              <QueryPerformancePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;

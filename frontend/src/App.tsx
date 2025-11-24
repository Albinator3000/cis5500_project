import React from "react";
import { Routes, Route, Link, NavLink } from "react-router-dom";
import EventStudyPage from "./pages/EventStudyPage";
import RegimeScreenerPage from "./pages/RegimeScreenerPage";
import RulesLabPage from "./pages/RulesLabPage";
import TimingsPage from "./pages/TimingsPage";
import DataAdminPage from "./pages/DataAdminPage";

const App: React.FC = () => {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "1rem", borderBottom: "1px solid #ddd" }}>
        <h1>Funding-Aware Market Maker</h1>
        <nav style={{ marginTop: "0.5rem" }}>
          <NavLink to="/" end style={{ marginRight: "1rem" }}>
            Event Study
          </NavLink>
          <NavLink to="/regimes" style={{ marginRight: "1rem" }}>
            Regime Screener
          </NavLink>
          <NavLink to="/rules" style={{ marginRight: "1rem" }}>
            Rules Lab
          </NavLink>
          <NavLink to="/timings" style={{ marginRight: "1rem" }}>
            Timings
          </NavLink>
          <NavLink to="/admin">Data Admin</NavLink>
        </nav>
      </header>
      <main style={{ padding: "1rem" }}>
        <Routes>
          <Route path="/" element={<EventStudyPage />} />
          <Route path="/regimes" element={<RegimeScreenerPage />} />
          <Route path="/rules" element={<RulesLabPage />} />
          <Route path="/timings" element={<TimingsPage />} />
          <Route path="/admin" element={<DataAdminPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;

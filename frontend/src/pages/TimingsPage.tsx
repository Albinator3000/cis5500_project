// TimingsPage.tsx
import React from "react";

const TimingsPage: React.FC = () => {
  return (
    <div>
      <h2>Timings Dashboard</h2>
      <p>
        Here we will display pre- and post-optimization runtimes and query plans
        for our 4 complex queries (pulled from logs or additional endpoints).
      </p>
      <p>Backend support: you can instrument endpoints and persist timings to a table for display.</p>
    </div>
  );
};

export default TimingsPage;

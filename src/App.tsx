import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import PlatformPage from './pages/PlatformPage';
import { ThemeContextProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  return (
    <Router>
      <CssBaseline />
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<PlatformPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeContextProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeContextProvider>
    </ErrorBoundary>
  );
};

export default App;

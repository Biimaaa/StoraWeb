import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './store/ThemeContext';
import { AuthProvider } from './store/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DisksPage } from './pages/DisksPage';
import { PoolsPage } from './pages/PoolsPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { SnapshotsPage } from './pages/SnapshotsPage';
import { SharingPage } from './pages/SharingPage';
import { DataProtectionPage } from './pages/DataProtectionPage';
import { UsersPage } from './pages/UsersPage';
import { NetworkPage } from './pages/NetworkPage';
import { SystemPage } from './pages/SystemPage';
import { SetupWizardPage } from './pages/SetupWizardPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/setup" element={<SetupWizardPage />} />

              {/* Protected dashboard layout */}
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="storage/pools" element={<PoolsPage />} />
                <Route path="storage/datasets" element={<DatasetsPage />} />
                <Route path="storage/disks" element={<DisksPage />} />
                <Route path="storage/snapshots" element={<SnapshotsPage />} />
                <Route path="sharing" element={<SharingPage />} />
                <Route path="data-protection" element={<DataProtectionPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="network" element={<NetworkPage />} />
                <Route path="system" element={<SystemPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;

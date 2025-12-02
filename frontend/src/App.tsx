import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ContainersPage from './pages/ContainersPage';
import ContainerDetailsPage from './pages/ContainerDetailsPage';
import TestConsolePage from './pages/TestConsolePage';
import IngestPage from './pages/IngestPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="containers" element={<ContainersPage />} />
          <Route path="containers/:id" element={<ContainerDetailsPage />} />
          <Route path="ingest" element={<IngestPage />} />
          <Route path="test-console" element={<TestConsolePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

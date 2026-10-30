import { Navigate, Route, Routes } from 'react-router-dom';
import { ActiveScanProvider } from './context/ActiveScanProvider.jsx';
import { CatalogProvider, useCatalog } from './context/CatalogProvider.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { ErrorState, PageLoading } from './components/ui/States.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import HomePage from './pages/HomePage.jsx';
import IntegrationPage from './pages/IntegrationPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import ScanPage from './pages/ScanPage.jsx';

/** No muestra ninguna pantalla hasta tener el catálogo de reglas; si falla, permite reintentar. */
function CatalogGate({ children }) {
  const { catalog, error, reload } = useCatalog();
  if (error) return <ErrorState error={error} onRetry={reload} title="No se pudo conectar con el servidor" />;
  if (!catalog) return <PageLoading label="Cargando reglas de verificación…" />;
  return children;
}

export default function App() {
  return (
    <ActiveScanProvider>
      <CatalogProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<CatalogGate><HomePage /></CatalogGate>} />
            <Route path="verificaciones/:id" element={<CatalogGate><ScanPage /></CatalogGate>} />
            <Route path="verificaciones/:id/informe" element={<CatalogGate><ReportPage /></CatalogGate>} />
            <Route path="historial" element={<HistoryPage />} />
            <Route path="integracion" element={<IntegrationPage />} />
            {/* Rutas del mockup anterior */}
            <Route path="inicio" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </CatalogProvider>
    </ActiveScanProvider>
  );
}

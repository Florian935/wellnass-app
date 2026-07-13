import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { AdminLayout } from './components/AdminLayout';
import { LoginScreen } from './screens/LoginScreen';
import { HomePlaceholder } from './screens/HomePlaceholder';

/**
 * Point d'entrée de l'app admin. Routes : `/login` public ; groupe protégé
 * (RequireAuth → AdminLayout) avec `/` → accueil placeholder ; toute autre
 * route retombe sur `/`.
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<HomePlaceholder />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

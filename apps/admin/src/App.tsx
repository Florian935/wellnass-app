import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RolesProvider } from './auth/RolesProvider';
import { RequireAuth } from './auth/RequireAuth';
import { RequireAdmin } from './auth/RequireAdmin';
import { useRoles } from './auth/useRoles';
import { AdminLayout } from './components/AdminLayout';
import { LoginScreen } from './screens/LoginScreen';
import { HomePlaceholder } from './screens/HomePlaceholder';
import { RolesScreen } from './screens/RolesScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { ExerciseEditScreen } from './screens/ExerciseEditScreen';
import { ProgramsScreen } from './screens/ProgramsScreen';
import { ProgramCreateScreen } from './screens/ProgramCreateScreen';
import { ProgramEditScreen } from './screens/ProgramEditScreen';

/**
 * Point d'entrée de l'app admin. Routes : `/login` public ; groupe protégé
 * (RequireAuth → RequireAdmin → AdminLayout). `/` → accueil ; `/roles` →
 * gestion des rôles (super_admin uniquement, sinon redirection vers `/`).
 * Toute autre route retombe sur `/`.
 */
export function App() {
  return (
    <AuthProvider>
      <RolesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route element={<RequireAuth />}>
              <Route element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route path="/" element={<HomePlaceholder />} />
                  <Route
                    path="/exercises"
                    element={
                      <RequireContentEditor>
                        <ExercisesScreen />
                      </RequireContentEditor>
                    }
                  />
                  <Route
                    path="/exercises/new"
                    element={
                      <RequireContentEditor>
                        <ExerciseEditScreen />
                      </RequireContentEditor>
                    }
                  />
                  <Route
                    path="/exercises/:id"
                    element={
                      <RequireContentEditor>
                        <ExerciseEditScreen />
                      </RequireContentEditor>
                    }
                  />
                  <Route
                    path="/programs"
                    element={
                      <RequireContentEditor>
                        <ProgramsScreen />
                      </RequireContentEditor>
                    }
                  />
                  <Route
                    path="/programs/new"
                    element={
                      <RequireContentEditor>
                        <ProgramCreateScreen />
                      </RequireContentEditor>
                    }
                  />
                  <Route
                    path="/programs/:id"
                    element={
                      <RequireContentEditor>
                        <ProgramEditScreen />
                      </RequireContentEditor>
                    }
                  />
                  <Route
                    path="/roles"
                    element={
                      <RequireSuperAdmin>
                        <RolesScreen />
                      </RequireSuperAdmin>
                    }
                  />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RolesProvider>
    </AuthProvider>
  );
}

/** Restreint une route au super_admin ; sinon renvoie vers l'accueil. */
function RequireSuperAdmin({ children }: { children: React.ReactElement }) {
  const { isSuperAdmin } = useRoles();
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** Restreint une route aux éditeurs de contenu (super_admin/content_editor). */
function RequireContentEditor({ children }: { children: React.ReactElement }) {
  const { isContentEditor } = useRoles();
  if (!isContentEditor) {
    return <Navigate to="/" replace />;
  }
  return children;
}

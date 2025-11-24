import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { TimesPage } from './pages/TimesPage';
import { AbsencePage } from './pages/AbsencePage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ReportsPage } from './pages/ReportsPage';
import { useAuth } from './AuthProvider';

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">Eingeloggt als</p>
            <p className="font-semibold">{auth.user?.name}</p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link to="/" className="hover:text-blue-600">
              Dashboard
            </Link>
            <Link to="/zeiten" className="hover:text-blue-600">
              Zeiterfassung
            </Link>
            <Link to="/abwesenheiten" className="hover:text-blue-600">
              Abwesenheiten
            </Link>
            {(auth.hasRole('hr', 'admin', 'lead')) && (
              <Link to="/mitarbeitende" className="hover:text-blue-600">
                Mitarbeitende
              </Link>
            )}
            {(auth.hasRole('hr', 'admin')) && (
              <Link to="/berichte" className="hover:text-blue-600">
                Berichte
              </Link>
            )}
            <button className="text-rose-600" onClick={auth.logout}>
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Shell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/zeiten" element={<TimesPage />} />
                <Route path="/abwesenheiten" element={<AbsencePage />} />
                <Route path="/mitarbeitende" element={<EmployeesPage />} />
                <Route path="/berichte" element={<ReportsPage />} />
              </Routes>
            </Shell>
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

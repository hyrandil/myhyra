import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
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

const navClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
    isActive ? 'bg-white text-sky-800 shadow' : 'text-sky-100 hover:bg-white/10'
  }`;

function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
      <aside className="w-64 bg-sky-900 text-sky-50 flex flex-col shadow-2xl">
        <div className="p-5 border-b border-sky-800">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-200">TimeCard</p>
          <p className="text-2xl font-bold">ZeitPilot</p>
          <p className="text-sky-200 text-sm mt-1">Schnelle Übersicht wie bei timeCard 10</p>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <NavLink to="/" className={navClasses} end>
            Dashboard
          </NavLink>
          <NavLink to="/zeiten" className={navClasses}>
            Kalender & Zeiten
          </NavLink>
          <NavLink to="/abwesenheiten" className={navClasses}>
            Abwesenheiten
          </NavLink>
          {(auth.hasRole('lead', 'hr', 'admin')) && (
            <NavLink to="/mitarbeitende" className={navClasses}>
              Mitarbeitende
            </NavLink>
          )}
          {(auth.hasRole('hr', 'admin')) && (
            <NavLink to="/berichte" className={navClasses}>
              Berichte
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t border-sky-800 bg-sky-950/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-sky-200">Eingeloggt</p>
              <p className="font-semibold">{auth.user?.name}</p>
              <p className="text-xs text-sky-200">{auth.user?.email}</p>
            </div>
            <button
              onClick={auth.logout}
              className="px-3 py-2 bg-white text-sky-900 rounded-lg font-semibold shadow hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Zeitübersicht</p>
              <p className="text-xl font-semibold">timeCard 10 inspiriertes Cockpit</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge bg-emerald-100 text-emerald-700">{auth.user?.role ?? 'User'}</span>
              <span className="badge bg-slate-200 text-slate-800">{auth.user?.email}</span>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-6 space-y-4 w-full">{children}</main>
      </div>
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

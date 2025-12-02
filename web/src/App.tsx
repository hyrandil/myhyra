import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { TimesPage } from './pages/TimesPage';
import { AbsencePage } from './pages/AbsencePage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ReportsPage } from './pages/ReportsPage';
import { OverviewCalendarPage } from './pages/OverviewCalendarPage';
import { PlanningPage } from './pages/PlanningPage';
import { InconsistentPage } from './pages/InconsistentPage';
import { useAuth } from './AuthProvider';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition border border-transparent ${
          isActive
            ? 'bg-white/20 text-white border-white/30 shadow-lg'
            : 'text-sky-100 hover:bg-white/10 hover:border-white/20'
        }`
      }
    >
      <span className="h-2 w-2 rounded-full bg-white/70" aria-hidden />
      {label}
    </NavLink>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const roleLabel = (role?: string | null) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'hr':
        return 'Personal';
      case 'lead':
        return 'Teamleiter';
      default:
        return 'Mitarbeiter';
    }
  };
  const displayName =
    [auth.user?.firstName ?? (auth.user as any)?.first_name, auth.user?.lastName ?? (auth.user as any)?.last_name]
      .filter(Boolean)
      .join(' ') || auth.user?.name;
  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="w-72 bg-gradient-to-b from-sky-900 via-sky-950 to-slate-950 text-sky-50 flex flex-col shadow-2xl relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2)_0,_transparent_60%)]" />
        <div className="p-6 border-b border-white/10 relative">
          <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200">Zeiterfassung</p>
          <p className="text-3xl font-black">ZeitPilot</p>
        </div>
        <nav className="p-4 space-y-1 flex-1 relative">
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/zeiten" label="Kalender & Zeiten" />
          <NavItem to="/uebersicht" label="Übersichtkalender" />
          <NavItem to="/abwesenheiten" label="Abwesenheiten" />
          {auth.hasRole('lead', 'hr', 'admin') && <NavItem to="/inkonsistenzen" label="Inkonsistenzen" />}
          {auth.hasRole('hr', 'admin') && <NavItem to="/planung" label="Stundenplanung" />}
          {auth.hasRole('lead', 'hr', 'admin') && <NavItem to="/mitarbeitende" label="Team" />}
          {auth.hasRole('hr', 'admin') && <NavItem to="/berichte" label="Berichte" />}
        </nav>
        <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur relative">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                {displayName?.[0] ?? '?'}
              </div>
              <div className="flex-1">
              <p className="text-xs uppercase text-sky-200">{roleLabel(auth.user?.role)}</p>
                <p className="font-semibold leading-tight">{displayName}</p>
                <p className="text-xs text-sky-200 truncate">{auth.user?.email}</p>
              </div>
          </div>
          <button
            onClick={auth.logout}
            className="mt-3 w-full bg-white text-sky-900 rounded-lg font-semibold py-2 shadow hover:bg-slate-100"
          >
            Sicher abmelden
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xl font-bold">Cockpit</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge bg-emerald-100 text-emerald-700">{roleLabel(auth.user?.role)}</span>
              <span className="badge bg-slate-200 text-slate-800">{auth.user?.email}</span>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8 space-y-5 w-full">{children}</main>
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
                <Route path="/uebersicht" element={<OverviewCalendarPage />} />
                <Route path="/abwesenheiten" element={<AbsencePage />} />
                <Route path="/inkonsistenzen" element={<InconsistentPage />} />
                <Route path="/planung" element={<PlanningPage />} />
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

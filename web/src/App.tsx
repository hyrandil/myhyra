import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { TimesPage } from './pages/TimesPage';
import { AbsencePage } from './pages/AbsencePage';
import {
  RequestsPage,
  AbsenceRequestsPage,
  CorrectionRequestsPage,
  CancellationRequestsPage,
} from './pages/RequestsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ReportsPage } from './pages/ReportsPage';
import { OverviewCalendarPage } from './pages/OverviewCalendarPage';
import { PlanningPage } from './pages/PlanningPage';
import { InconsistentPage } from './pages/InconsistentPage';
import { useAuth } from './AuthProvider';
import { MobileHomePage } from './pages/MobileHomePage';
import { useIsMobile } from './hooks/useIsMobile';
import { ApprovalListPage } from './pages/ApprovalListPage';

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
            ? 'bg-sky-50 text-sky-800 border-sky-200 shadow'
            : 'text-slate-600 hover:bg-slate-100 hover:border-slate-200'
        }`
      }
    >
      <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
      {label}
    </NavLink>
  );
}

function MobileNavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center text-[11px] font-semibold px-2 ${
          isActive ? 'text-sky-100' : 'text-slate-300'
        }`
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${to === '/' ? 'bg-emerald-400' : 'bg-sky-400'}`} aria-hidden />
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
      <aside className="w-72 bg-white text-slate-900 flex flex-col shadow-lg border-r border-slate-200 relative">
        <div className="p-6 border-b border-slate-200 relative bg-gradient-to-r from-sky-50 via-white to-blue-50">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Zeiterfassung</p>
          <p className="text-3xl font-black text-sky-800">ZeitPilot</p>
        </div>
        <nav className="p-4 space-y-1 flex-1 relative">
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/zeiten" label="Kalender & Zeiten" />
          <NavItem to="/uebersicht" label="Übersichtkalender" />
          <NavItem to="/antraege" label="Anträge" />
          {auth.hasRole('admin') && <NavItem to="/abwesenheiten" label="Abwesenheiten" />}
          {auth.hasRole('lead', 'hr', 'admin') && <NavItem to="/inkonsistenzen" label="Inkonsistenzen" />}
          {auth.hasRole('hr', 'admin') && <NavItem to="/planung" label="Stundenplanung" />}
          {auth.hasRole('hr', 'admin') && <NavItem to="/mitarbeitende" label="Team" />}
          {auth.hasRole('hr', 'admin') && <NavItem to="/berichte" label="Berichte" />}
        </nav>
        <div className="p-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-sky-100 flex items-center justify-center text-lg font-bold text-sky-800">
                {displayName?.[0] ?? '?'}
              </div>
              <div className="flex-1">
              <p className="text-xs uppercase text-slate-500">{roleLabel(auth.user?.role)}</p>
                <p className="font-semibold leading-tight text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-600 truncate">{auth.user?.email}</p>
              </div>
          </div>
          <button
            onClick={auth.logout}
            className="mt-3 w-full bg-sky-600 text-white rounded-lg font-semibold py-2 shadow hover:bg-sky-700"
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

function MobileShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const displayName =
    [auth.user?.firstName ?? (auth.user as any)?.first_name, auth.user?.lastName ?? (auth.user as any)?.last_name]
      .filter(Boolean)
      .join(' ') || auth.user?.name;
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
  return (
    <div className="min-h-screen bg-surface text-slate-900">
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">ZeitPilot</p>
          <p className="font-semibold leading-tight text-slate-900">{displayName || 'Willkommen'}</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-600">{roleLabel(auth.user?.role)}</p>
          <button onClick={auth.logout} className="underline text-sky-700 font-semibold">
            Abmelden
          </button>
        </div>
      </header>
      <main className="pb-20 pt-4 px-3 space-y-4">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 text-slate-900 border-t border-slate-200 shadow-[0_-6px_20px_rgba(15,23,42,0.12)] z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between text-center gap-2">
          <MobileNavItem to="/" label="Cockpit" />
          <MobileNavItem to="/zeiten" label="Zeiten" />
          <MobileNavItem to="/antraege" label="Anträge" />
          {auth.hasRole('admin') && <MobileNavItem to="/abwesenheiten" label="Abwesen" />}
          <MobileNavItem to="/berichte" label="Berichte" />
          {auth.hasRole('lead', 'hr', 'admin') && <MobileNavItem to="/inkonsistenzen" label="Checks" />}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const { user } = auth;
  const isMobile = useIsMobile();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          isMobile ? (
            <Protected>
              <MobileShell>
                <Routes>
                  <Route path="/" element={<MobileHomePage />} />
                  <Route path="/zeiten" element={<TimesPage />} />
                  <Route path="/antraege" element={<RequestsPage />} />
                  <Route path="/antraege/abwesenheit" element={<AbsenceRequestsPage />} />
                  <Route path="/antraege/korrektur" element={<CorrectionRequestsPage />} />
                  <Route path="/antraege/storno" element={<CancellationRequestsPage />} />
                  <Route path="/antraege/genehmigungen" element={<ApprovalListPage />} />
                  {auth.hasRole('admin') && <Route path="/abwesenheiten" element={<AbsencePage />} />}
                  <Route path="/berichte" element={<ReportsPage />} />
                  <Route path="/uebersicht" element={<OverviewCalendarPage />} />
                  {auth.hasRole('hr', 'admin') && <Route path="/mitarbeitende" element={<EmployeesPage />} />}
                  <Route path="/inkonsistenzen" element={<InconsistentPage />} />
                  <Route path="/planung" element={<PlanningPage />} />
                </Routes>
              </MobileShell>
            </Protected>
          ) : (
            <Protected>
              <Shell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/zeiten" element={<TimesPage />} />
                  <Route path="/uebersicht" element={<OverviewCalendarPage />} />
                  <Route path="/antraege" element={<RequestsPage />} />
                  <Route path="/antraege/abwesenheit" element={<AbsenceRequestsPage />} />
                  <Route path="/antraege/korrektur" element={<CorrectionRequestsPage />} />
                  <Route path="/antraege/storno" element={<CancellationRequestsPage />} />
                  <Route path="/antraege/genehmigungen" element={<ApprovalListPage />} />
                  {auth.hasRole('admin') && <Route path="/abwesenheiten" element={<AbsencePage />} />}
                  <Route path="/inkonsistenzen" element={<InconsistentPage />} />
                  <Route path="/planung" element={<PlanningPage />} />
                  {auth.hasRole('hr', 'admin') && <Route path="/mitarbeitende" element={<EmployeesPage />} />}
                  <Route path="/berichte" element={<ReportsPage />} />
                </Routes>
              </Shell>
            </Protected>
          )
        }
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

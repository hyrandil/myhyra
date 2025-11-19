import { useState } from 'react';
import { LoginCard } from './components/LoginCard';
import { BookingList } from './components/BookingList';
import { ActionsCard } from './components/ActionsCard';
import { AdminTable } from './components/AdminTable';
import { useAuth } from './hooks/useAuth';

function Dashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<'own' | 'admin'>('own');

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Eingeloggt als</p>
          <p className="font-semibold">{user?.name}</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'admin' && (
            <div className="bg-slate-100 rounded px-2 py-1 text-sm">
              <button
                onClick={() => setView('own')}
                className={`px-2 ${view === 'own' ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}
              >
                Eigene
              </button>
              <button
                onClick={() => setView('admin')}
                className={`px-2 ${view === 'admin' ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}
              >
                Admin
              </button>
            </div>
          )}
          <button className="text-sm text-rose-600" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      {view === 'own' && (
        <div className="space-y-4">
          <ActionsCard />
          <BookingList />
        </div>
      )}
      {view === 'admin' && user?.role === 'admin' && <AdminTable />}
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoginCard onSubmit={auth.login} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Dashboard />
    </div>
  );
}

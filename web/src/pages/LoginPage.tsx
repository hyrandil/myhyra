import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe!123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.response?.data?.errors?.message ||
        'Login fehlgeschlagen';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="grid lg:grid-cols-3 max-w-5xl w-full shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-br from-sky-900 via-sky-950 to-slate-950 text-white p-8 relative lg:col-span-1">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.25)_0,_transparent_55%)]" />
          <div className="relative space-y-3">
            <p className="text-[11px] uppercase tracking-[0.35em] text-sky-100">TimeCard Look</p>
            <h1 className="text-4xl font-black">ZeitPilot</h1>
            <p className="text-sky-100 text-sm max-w-xs">Kioskartige Anmeldung mit vorausgefüllten Admin-Daten.</p>
            <div className="mt-6 space-y-2 text-sm text-sky-100/80">
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-300"></span> Rollenbasiertes Cockpit
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-300"></span> Schnellzugriff Stempeln
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-300"></span> Kompakte Kalenderansicht
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white lg:col-span-2 p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Anmeldung</p>
          <h2 className="text-2xl font-bold mt-1">Mit Zeitkonto fortfahren</h2>
          <p className="text-sm text-slate-600">Standard-Admin: admin@example.com / ChangeMe!123</p>
          <form onSubmit={submit} className="space-y-4 mt-6">
            <label className="block text-sm font-medium text-slate-700">
              E-Mail
              <input
                className="mt-1 w-full rounded-lg px-3 py-2 text-slate-900 border border-slate-200 focus:ring-2 focus:ring-sky-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Passwort
              <input
                className="mt-1 w-full rounded-lg px-3 py-2 text-slate-900 border border-slate-200 focus:ring-2 focus:ring-sky-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit"
              className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:bg-sky-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Anmeldung...' : 'Einloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-900 via-slate-900 to-slate-800 px-4">
      <div className="card-ghost max-w-xl w-full p-8 text-white bg-white/10 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-100">TimeCard 10 Stil</p>
            <h1 className="text-3xl font-bold">ZeitPilot Login</h1>
            <p className="text-sky-100 text-sm mt-1">Zentraler Login mit vorkonfiguriertem Admin</p>
          </div>
          <div className="bg-white/20 rounded-full h-14 w-14 flex items-center justify-center text-xl font-bold">
            ⏱️
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            E-Mail
            <input
              className="mt-1 w-full rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Passwort
            <input
              className="mt-1 w-full rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          {error && <p className="text-sm text-rose-200">{error}</p>}
          <button
            type="submit"
            className="w-full bg-emerald-500 text-white py-3 rounded-lg font-semibold shadow-lg hover:bg-emerald-600 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Anmeldung...' : 'Einloggen'}
          </button>
          <p className="text-xs text-slate-200 mt-2">Standard: admin@example.com / ChangeMe!123</p>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/90 backdrop-blur shadow-lg rounded-2xl border border-slate-200 p-7 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Anmeldung</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            E-Mail
            <input
              className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 border border-slate-200 focus:ring-2 focus:ring-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="username"
              placeholder="name@firma.de"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Passwort
            <input
              className="mt-1 w-full rounded-xl px-3 py-2 text-slate-900 border border-slate-200 focus:ring-2 focus:ring-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            className="w-full bg-sky-600 text-white py-3 rounded-xl font-semibold hover:bg-sky-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Anmeldung...' : 'Einloggen'}
          </button>
        </form>
      </div>
    </div>
  );
}

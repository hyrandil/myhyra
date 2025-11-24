import { useState } from 'react';
import { useAuth } from '../AuthProvider';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError('Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="bg-white shadow rounded p-6 w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Zeiterfassung Login</h1>
          <p className="text-slate-500 text-sm">Bitte melden Sie sich mit Ihrem Firmen-Login an.</p>
        </div>
        <label className="block text-sm font-medium">
          E-Mail
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Passwort
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded"
          disabled={loading}
        >
          {loading ? 'Anmeldung...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

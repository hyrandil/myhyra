import { FormEvent, useState } from 'react';

interface Props {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginCard({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded p-6 space-y-4 w-full max-w-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Willkommen zurück</h1>
        <p className="text-sm text-slate-500">Melde dich mit deinem Firmenkonto an.</p>
      </div>
      <label className="flex flex-col text-sm text-slate-600">
        E-Mail
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
      </label>
      <label className="flex flex-col text-sm text-slate-600">
        Passwort
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Anmeldung...' : 'Einloggen'}
      </button>
    </form>
  );
}

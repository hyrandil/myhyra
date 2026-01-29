import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateMyPassword } from '../api';

export function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: () => updateMyPassword({ currentPassword, nextPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccess('Passwort wurde aktualisiert.');
    },
    onError: () => {
      setSuccess(null);
      setError('Passwort konnte nicht aktualisiert werden.');
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPassword || !nextPassword) return;
    if (nextPassword !== confirmPassword) {
      setError('Die neuen Passwörter stimmen nicht überein.');
      setSuccess(null);
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Einstellungen</p>
          <h2 className="text-2xl font-semibold text-slate-900">Passwort ändern</h2>
          <p className="text-sm text-slate-500">Aktualisiere dein Passwort mit deinem aktuellen Zugang.</p>
        </div>
      </div>

      <div className="card p-4 max-w-xl">
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Altes Passwort</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Neues Passwort</label>
            <input
              className="input"
              type="password"
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Neues Passwort bestätigen</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <button className="btn-primary" type="submit" disabled={passwordMutation.isPending}>
            Passwort speichern
          </button>
        </form>
      </div>
    </div>
  );
}

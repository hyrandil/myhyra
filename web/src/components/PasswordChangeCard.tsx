import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../api';

export function PasswordChangeCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch('/users/me/password', form);
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'Die neuen Passwörter stimmen nicht überein.' });
      return;
    }
    try {
      await mutation.mutateAsync();
      setMessage({ type: 'success', text: 'Passwort erfolgreich aktualisiert.' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Passwort konnte nicht geändert werden.',
      });
    }
  };

  return (
    <form className="bg-white rounded shadow p-4 space-y-3" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-base font-semibold text-slate-800">Eigenes Passwort ändern</h3>
        <p className="text-xs text-slate-500">Bitte gib dein aktuelles Passwort ein und bestätige das neue doppelt.</p>
      </div>
      <label className="text-xs font-semibold text-slate-600">
        Aktuelles Passwort
        <input
          type="password"
          value={form.currentPassword}
          onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          required
          minLength={6}
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Neues Passwort
        <input
          type="password"
          value={form.newPassword}
          onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          required
          minLength={6}
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Neues Passwort bestätigen
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          required
          minLength={6}
        />
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded bg-slate-900 py-2 text-white font-semibold disabled:opacity-50"
      >
        {mutation.isPending ? 'Speichere...' : 'Passwort aktualisieren'}
      </button>
      {message && (
        <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { useUserSettings } from '../hooks/useSettings';

export function PreferencesCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useUserSettings();
  const [form, setForm] = useState({
    daily_target_minutes: 480,
    email_notifications: true,
    weekly_summary: false,
    language: 'de' as 'de' | 'en',
    theme: 'system' as 'light' | 'dark' | 'system',
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        daily_target_minutes: data.daily_target_minutes,
        email_notifications: data.email_notifications,
        weekly_summary: data.weekly_summary,
        language: data.language,
        theme: data.theme,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      await api.patch('/users/me/settings', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'me'] });
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      await mutation.mutateAsync(form);
      setMessage('Einstellungen gespeichert.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Speichern fehlgeschlagen.');
    }
  };

  const updateForm = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const targets = [360, 420, 450, 480, 510, 540];

  return (
    <div className="rounded-md bg-white p-6 shadow">
      <h3 className="text-lg font-semibold text-slate-900">Arbeitszeit & Mitteilungen</h3>
      <p className="text-sm text-slate-500">Lege Zielarbeitszeiten fest und bestimme, welche Hinweise du erhalten möchtest.</p>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Lade Einstellungen...</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Tägliche Sollzeit
            <select
              value={form.daily_target_minutes}
              onChange={(event) => updateForm('daily_target_minutes', Number(event.target.value))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              {targets.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {(minutes / 60).toFixed(1).replace('.0', '')} Stunden
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-2 rounded border border-slate-200 p-3">
              <input
                type="checkbox"
                checked={form.email_notifications}
                onChange={(event) => updateForm('email_notifications', event.target.checked)}
              />
              <span>
                <span className="block font-semibold text-slate-800">E-Mail-Erinnerungen</span>
                <span className="text-xs text-slate-500">
                  Sende mir Hinweise, wenn ich vergesse zu stempeln oder mein Tag offen ist.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded border border-slate-200 p-3">
              <input
                type="checkbox"
                checked={form.weekly_summary}
                onChange={(event) => updateForm('weekly_summary', event.target.checked)}
              />
              <span>
                <span className="block font-semibold text-slate-800">Wöchentliche Übersicht</span>
                <span className="text-xs text-slate-500">Sende montags einen Überblick über Arbeits- und Abwesenheitszeiten.</span>
              </span>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Sprache
              <select
                value={form.language}
                onChange={(event) => updateForm('language', event.target.value as 'de' | 'en')}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              >
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Design
              <select
                value={form.theme}
                onChange={(event) => updateForm('theme', event.target.value as 'light' | 'dark' | 'system')}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              >
                <option value="system">System</option>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded bg-slate-900 py-2 text-white font-semibold disabled:opacity-50"
          >
            {mutation.isPending ? 'Speichere...' : 'Einstellungen sichern'}
          </button>
          {message && <p className="text-xs text-emerald-600">{message}</p>}
        </form>
      )}
    </div>
  );
}

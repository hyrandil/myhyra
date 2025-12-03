import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { useUserSettings } from '../hooks/useSettings';

type PreferencesForm = {
  language: 'de' | 'en';
  week_start: 'monday' | 'sunday';
  time_format: '24h' | '12h';
};

export function PreferencesCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useUserSettings();
  const [form, setForm] = useState<PreferencesForm>({
    language: 'de',
    week_start: 'monday',
    time_format: '24h',
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        language: data.language,
        week_start: data.week_start,
        time_format: data.time_format,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: PreferencesForm) => {
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

  const updateForm = (field: keyof PreferencesForm, value: PreferencesForm[keyof PreferencesForm]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="rounded-md bg-white p-6 shadow">
      <h3 className="text-lg font-semibold text-slate-900">Persönliche Einstellungen</h3>
      <p className="text-sm text-slate-500">
        Lege fest, wie Kalender, Sprachen und Uhrzeiten in deiner Oberfläche dargestellt werden.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Lade Einstellungen...</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Sprache
              <select
                value={form.language}
                onChange={(event) => updateForm('language', event.target.value as PreferencesForm['language'])}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              >
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Start der Woche
              <select
                value={form.week_start}
                onChange={(event) => updateForm('week_start', event.target.value as PreferencesForm['week_start'])}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              >
                <option value="monday">Montag</option>
                <option value="sunday">Sonntag</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Zeitformat
            <select
              value={form.time_format}
              onChange={(event) => updateForm('time_format', event.target.value as PreferencesForm['time_format'])}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="24h">24-Stunden-Anzeige</option>
              <option value="12h">12-Stunden-Anzeige</option>
            </select>
          </label>
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

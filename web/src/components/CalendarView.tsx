import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Booking } from '../types';
import { buildCalendarDays, formatMinutes, getDateKey, groupBookingsByDay } from '../utils/time';

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface CalendarViewProps {
  title: string;
  subtitle?: string;
  bookings: Booking[];
  isLoading: boolean;
  onRefresh?: () => void;
  emptyState?: string;
  dataKey?: string | number | null;
  onUpdateBooking?: (bookingId: number, payload: { clock_in?: string; clock_out?: string | null }) => Promise<unknown>;
}

const toInputValue = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function MapPreview({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) {
    return <p className="text-sm text-slate-500">Kein Standort gespeichert.</p>;
  }
  const src = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-500">Koordinaten: {lat.toFixed(5)}, {lng.toFixed(5)}</p>
      <div className="h-36 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <iframe
          title="Google Maps Vorschau"
          src={src}
          loading="lazy"
          className="h-full w-full"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>
  );
}

export function CalendarView({
  title,
  subtitle,
  bookings,
  isLoading,
  onRefresh,
  emptyState = 'Keine Buchungen für diesen Tag.',
  dataKey,
  onUpdateBooking,
}: CalendarViewProps) {
  const todayKey = getDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ clock_in: string; clock_out: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedDate(todayKey);
    setCurrentMonth(new Date());
    setExpandedBookingId(null);
    setEditingBookingId(null);
  }, [dataKey]);

  const grouped = useMemo(() => groupBookingsByDay(bookings), [bookings]);
  const monthDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const selectedBookings = grouped[selectedDate]?.bookings ?? [];
  const summary = grouped[selectedDate]?.summary ?? { workMinutes: 0, breakMinutes: 0 };
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingBookingId || !editValues || !onUpdateBooking) {
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      const payload: { clock_in?: string; clock_out?: string | null } = {};
      if (editValues.clock_in) {
        payload.clock_in = new Date(editValues.clock_in).toISOString();
      }
      if (editValues.clock_out) {
        payload.clock_out = new Date(editValues.clock_out).toISOString();
      } else {
        payload.clock_out = null;
      }
      await onUpdateBooking(editingBookingId, payload);
      setEditingBookingId(null);
    } catch (error: any) {
      setEditError(error?.response?.data?.message || 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-md shadow p-4 space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="rounded border border-slate-200 px-2 py-1"
          >
            ←
          </button>
          <span className="min-w-[140px] text-center font-medium text-slate-700">
            {currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="rounded border border-slate-200 px-2 py-1"
          >
            →
          </button>
          {onRefresh && (
            <button onClick={onRefresh} className="ml-2 text-blue-600">
              Aktualisieren
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p>Lade Buchungen...</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const hasEntries = Boolean(grouped[day.key]);
              const isSelected = day.key === selectedDate;
              return (
                <button
                  key={day.key}
                  onClick={() => {
                    setSelectedDate(day.key);
                    setExpandedBookingId(null);
                    setEditingBookingId(null);
                    if (!day.isCurrentMonth) {
                      setCurrentMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                    }
                  }}
                  className={`h-12 rounded-md border text-xs transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : hasEntries
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-transparent bg-slate-100 text-slate-500'
                  } ${day.isCurrentMonth ? '' : 'opacity-60'}`}
                >
                  <div>{day.date.getDate()}</div>
                  {hasEntries && <div className="mt-1 h-1 w-1 rounded-full bg-current mx-auto" />}
                </button>
              );
            })}
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm uppercase text-slate-500">Ausgewählter Tag</p>
                <p className="text-lg font-semibold">{selectedDateLabel}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Arbeitszeit</p>
                  <p className="text-base font-semibold text-slate-900">{formatMinutes(summary.workMinutes)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Pausenzeit</p>
                  <p className="text-base font-semibold text-slate-900">{formatMinutes(summary.breakMinutes)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {selectedBookings.length === 0 ? (
              <p className="text-sm text-slate-500">{emptyState}</p>
            ) : (
              selectedBookings.map((booking) => {
                const isExpanded = expandedBookingId === booking.id;
                const isEditing = editingBookingId === booking.id;
                return (
                  <div key={booking.id} className="rounded border border-slate-200 p-4 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-500">Kommen</p>
                        <p className="font-medium text-slate-900">
                          {new Date(booking.clock_in).toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Gehen</p>
                        <p className="font-medium text-slate-900">
                          {booking.clock_out
                            ? new Date(booking.clock_out).toLocaleTimeString('de-DE', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Noch offen'}
                        </p>
                      </div>
                      <button
                        onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                        className="text-sm text-blue-600"
                      >
                        {isExpanded ? 'Standort verbergen' : 'Standort anzeigen'}
                      </button>
                      {onUpdateBooking && (
                        <button
                          onClick={() => {
                            if (isEditing) {
                              setEditingBookingId(null);
                              return;
                            }
                            setEditValues({
                              clock_in: toInputValue(booking.clock_in),
                              clock_out: toInputValue(booking.clock_out),
                            });
                            setEditingBookingId(booking.id);
                            setEditError(null);
                          }}
                          className="text-sm text-slate-500 underline"
                        >
                          {isEditing ? 'Bearbeitung abbrechen' : 'Zeiten bearbeiten'}
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Kommen-Standort</p>
                          <MapPreview lat={booking.clock_in_lat} lng={booking.clock_in_lng} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Gehen-Standort</p>
                          <MapPreview lat={booking.clock_out_lat} lng={booking.clock_out_lng} />
                        </div>
                      </div>
                    )}
                    {isEditing && onUpdateBooking && editValues && (
                      <form onSubmit={handleEditSubmit} className="mt-4 space-y-2 rounded-md bg-slate-50 p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-500">
                            Kommen
                            <input
                              type="datetime-local"
                              value={editValues.clock_in}
                              onChange={(event) =>
                                setEditValues((prev) => {
                                  const base = prev ?? { clock_in: '', clock_out: '' };
                                  return { ...base, clock_in: event.target.value };
                                })
                              }
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                              required
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-500">
                            Gehen
                            <input
                              type="datetime-local"
                              value={editValues.clock_out}
                              onChange={(event) =>
                                setEditValues((prev) => {
                                  const base = prev ?? { clock_in: '', clock_out: '' };
                                  return { ...base, clock_out: event.target.value };
                                })
                              }
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                          </label>
                        </div>
                        {editError && <p className="text-xs text-rose-600">{editError}</p>}
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="rounded bg-blue-600 px-3 py-1 text-white text-sm font-semibold disabled:opacity-50"
                          >
                            {isSaving ? 'Speichere...' : 'Änderungen sichern'}
                          </button>
                          <span>Leeres Gehen-Feld speichert eine offene Buchung.</span>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

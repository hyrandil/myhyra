import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { downloadAttendanceCsv, downloadAttendanceXlsx, fetchAttendance, fetchOwnMonthlyReport } from '../api';
import { AttendanceResponse } from '../types';
import { useAuth } from '../AuthProvider';

export function ReportsPage() {
  const { user, hasRole } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['reports', 'attendance', month],
    queryFn: () => fetchAttendance(month),
  });

  const maxPresence = useMemo(() => {
    const values = (data?.rows ?? []).map((r) => r.presenceDays);
    return values.length ? Math.max(...values) : 0;
  }, [data]);

  const triggerDownload = async (kind: 'csv' | 'xlsx') => {
    const blob = kind === 'csv' ? await downloadAttendanceCsv(month) : await downloadAttendanceXlsx(month);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${month}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string) => {
    const [datePart, timePart] = timestamp.split(' ');
    const [hour = '00', minute = '00'] = (timePart ?? '').split(':');
    return `${datePart} ${hour}:${minute}`;
  };

  const exportPdf = async () => {
    const report = await fetchOwnMonthlyReport(month);
    const doc = new jsPDF();
    const formatDate = (value: string) => {
      const [year, monthPart, day] = value.split('-').map((v) => parseInt(v, 10));
      const date = new Date(Date.UTC(year, (monthPart ?? 1) - 1, day ?? 1));
      return date.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
    };
    const formatDay = (value: string) => {
      const [year, monthPart, day] = value.split('-').map((v) => parseInt(v, 10));
      const date = new Date(Date.UTC(year, (monthPart ?? 1) - 1, day ?? 1));
      return date.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' });
    };
    const cols = [
      { label: 'Datum', width: 22 },
      { label: 'Tag', width: 12 },
      { label: 'Kommen', width: 22 },
      { label: 'Gehen', width: 22 },
      { label: 'Pause', width: 18 },
      { label: 'Sollzeit', width: 18 },
      { label: 'Arbeitszeit', width: 20 },
      { label: 'GLZ', width: 18 },
      { label: 'Status', width: 32 },
    ];
    const startX = 14;
    let y = 20;
    doc.setFontSize(14);
    doc.text('Monatsübersicht', startX, y);
    doc.setFontSize(11);
    doc.text(month, startX + 70, y);
    y += 8;
    doc.setFontSize(10);
    const metaLines = [
      report.meta?.name ? `Mitarbeiter: ${report.meta.name}` : undefined,
      report.meta?.personnelNumber ? `Personalnummer: ${report.meta.personnelNumber}` : undefined,
    ].filter(Boolean) as string[];
    metaLines.forEach((line) => {
      doc.text(line, startX, y);
      y += 6;
    });
    if (report.meta?.vacation || report.meta?.flexBalance !== undefined) {
      doc.text(
        `Urlaub gesamt: ${report.meta?.vacation?.allowance ?? 0} | genutzt: ${
          report.meta?.vacation?.used?.toFixed(2) ?? '0.00'
        } | Rest: ${report.meta?.vacation?.remaining?.toFixed(2) ?? '0.00'}`,
        startX,
        y
      );
      y += 6;
      if (report.meta?.flexBalance !== undefined) {
        doc.text(`Gleitzeitstand: ${formatHours(report.meta.flexBalance)}`, startX, y);
        y += 4;
      }
    }
    y += 4;
    doc.setFontSize(10);
    const headerHeight = 8;
    let xCursor = startX;
    doc.setFillColor(240, 245, 255);
    doc.rect(startX - 2, y - headerHeight + 2, cols.reduce((sum, c) => sum + c.width, 0) + 4, headerHeight, 'F');
    cols.forEach((col) => {
      doc.text(col.label, xCursor, y);
      xCursor += col.width;
    });
    y += 4;
    const total = { planned: 0, worked: 0, delta: 0, pause: 0 };
    report.days.forEach((day) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const clockIns = day.entries.filter((e) => e.type === 'CLOCK_IN');
      const clockOuts = day.entries.filter((e) => e.type === 'CLOCK_OUT');
      const formatClock = (value?: string) => (value ? formatTime(value) : '—');
      const firstIn = clockIns.length ? formatClock(clockIns[0].timestamp) : '—';
      const lastOut = clockOuts.length ? formatClock(clockOuts[clockOuts.length - 1].timestamp) : '—';
      const pauseMinutes = (day.recordedBreakMinutes ?? 0) + (day.autoBreakMinutes ?? 0);
      const label = day.absences.length
        ? day.absences
            .map((abs) => abs.type || abs.duration || 'Abwesenheit')
            .filter(Boolean)
            .join(', ')
        : '';
      total.planned += day.planned;
      total.worked += day.worked;
      total.delta += day.delta;
      total.pause += pauseMinutes;
      const row = [
        formatDate(day.date),
        formatDay(day.date),
        firstIn,
        lastOut,
        formatHours(pauseMinutes),
        formatHours(day.planned),
        formatHours(day.worked),
        formatHours(day.delta),
        label || '—',
      ];
      xCursor = startX;
      doc.setFont('helvetica', day.pending ? 'italic' : 'normal');
      row.forEach((cell, idx) => {
        doc.text(String(cell), xCursor, y + 6);
        xCursor += cols[idx].width;
      });
      doc.line(startX - 2, y + 8, startX + cols.reduce((sum, c) => sum + c.width, 0) + 2, y + 8);
      y += 10;
    });
    doc.setFont('helvetica', 'bold');
    xCursor = startX;
    const totalsRow = ['Summe', '', '', '', formatHours(total.pause), formatHours(total.planned), formatHours(total.worked), formatHours(total.delta), ''];
    totalsRow.forEach((cell, idx) => {
      if (cell) {
        doc.text(String(cell), xCursor, y + 6);
      }
      xCursor += cols[idx].width;
    });
    doc.save(`monatsreport-${month}-${report.meta?.personnelNumber || user?.id || 'ich'}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Reports</p>
          <h2 className="text-2xl font-semibold">Anwesenheits- &amp; Urlaubsstatistik</h2>
          <p className="text-sm text-slate-500">Zeitraum wählbar, Export als CSV/Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-slate-600">Monat:</label>
          <input
            type="month"
            className="input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          {hasRole('admin') && (
            <>
              <button className="btn-primary" onClick={() => triggerDownload('csv')}>
                CSV Export
              </button>
              <button className="btn-primary" onClick={() => triggerDownload('xlsx')}>
                Excel Export
              </button>
            </>
          )}
          <button className="btn-primary" onClick={exportPdf}>
            PDF Export
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          {isLoading && <p className="text-sm text-slate-500">Lade…</p>}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Name</th>
                  <th>Präsenz</th>
                  {(data?.kinds ?? []).map((kind) => (
                    <th key={kind.code}>{kind.label}</th>
                  ))}
                  <th>Resturlaub</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row) => (
                  <tr key={row.user_id} className="border-b hover:bg-slate-50">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td>{row.presenceDays}</td>
                    {(data?.kinds ?? []).map((kind) => (
                      <td key={`${row.user_id}-${kind.code}`}>{row.absences[kind.code] ?? 0}</td>
                    ))}
                    <td>{row.remainingVacation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.rows ?? []).length === 0 && <p className="text-sm text-slate-500 mt-2">Keine Daten vorhanden.</p>}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="text-lg font-semibold">Visualisierung</h3>
          <p className="text-sm text-slate-500">Vergleich Präsenz- und Abwesenheitstage.</p>
          <div className="space-y-2">
            {(data?.rows ?? []).map((row) => {
              const presenceWidth = maxPresence ? Math.round((row.presenceDays / maxPresence) * 100) : 0;
              const vacationWidth = Math.min(100, Math.round((row.absences['vacation'] ?? 0) * 4));
              return (
                <div key={row.user_id} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.name}</span>
                    <span>{row.presenceDays} Tage</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-2 bg-emerald-500" style={{ width: `${presenceWidth}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    {(data?.kinds ?? []).map((kind) => (
                      <span key={`${row.user_id}-${kind.code}`}>{kind.label}: {row.absences[kind.code] ?? 0}</span>
                    ))}
                  </div>
                  <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                    <div className="h-2 bg-amber-500" style={{ width: `${vacationWidth}%` }}></div>
                  </div>
                </div>
              );
            })}
            {(data?.rows ?? []).length === 0 && <p className="text-sm text-slate-500">Keine Daten vorhanden.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

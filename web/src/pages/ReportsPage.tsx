import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { downloadAttendanceCsv, downloadAttendanceXlsx, fetchAttendance, fetchEmployees, fetchMonthlyReport, fetchOwnMonthlyReport } from '../api';
import { AttendanceResponse, Employee } from '../types';
import { useAuth } from '../AuthProvider';

export function ReportsPage() {
  const { user, hasRole } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['reports', 'attendance', month],
    queryFn: () => fetchAttendance(month),
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees', 'report'],
    queryFn: () => fetchEmployees(),
    enabled: hasRole('admin'),
  });


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

  const exportPdf = async (options?: { employeeId?: number | null; orientation?: 'portrait' | 'landscape' }) => {
    const report = options?.employeeId
      ? await fetchMonthlyReport(options.employeeId, month)
      : await fetchOwnMonthlyReport(month);
    const orientation = options?.orientation ?? 'portrait';
    const doc = new jsPDF({ orientation });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
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
    const startX = 10;
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
    doc.setFontSize(orientation === 'landscape' ? 9 : 10);
    const headerHeight = orientation === 'landscape' ? 6 : 8;
    let xCursor = startX;
    const colTotal = cols.reduce((sum, c) => sum + c.width, 0);
    const availableWidth = pageWidth - startX * 2;
    const scale = colTotal > availableWidth ? availableWidth / colTotal : 1;
    doc.setFillColor(240, 245, 255);
    doc.rect(startX - 2, y - headerHeight + 2, colTotal * scale + 4, headerHeight, 'F');
    cols.forEach((col) => {
      doc.text(col.label, xCursor, y);
      xCursor += col.width * scale;
    });
    y += orientation === 'landscape' ? 3 : 4;
    const total = { planned: 0, worked: 0, delta: 0, pause: 0 };
    const maxRows = report.days.length + 3;
    const availableHeight = pageHeight - y - 16;
    const rowHeight = orientation === 'landscape' ? Math.max(4, Math.floor(availableHeight / maxRows)) : 10;
    report.days.forEach((day) => {
      if (orientation === 'portrait' && y > 280) {
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
        doc.text(String(cell), xCursor, y + rowHeight - 2);
        xCursor += cols[idx].width * scale;
      });
      doc.line(startX - 2, y + rowHeight, startX + colTotal * scale + 2, y + rowHeight);
      y += rowHeight;
    });
    doc.setFont('helvetica', 'bold');
    xCursor = startX;
    const totalsRow = ['Summe', '', '', '', formatHours(total.pause), formatHours(total.planned), formatHours(total.worked), formatHours(total.delta), ''];
    totalsRow.forEach((cell, idx) => {
      if (cell) {
        doc.text(String(cell), xCursor, y + rowHeight - 2);
      }
      xCursor += cols[idx].width * scale;
    });
    doc.save(`monatsreport-${month}-${report.meta?.personnelNumber || user?.id || 'ich'}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reports</p>
            <h2 className="text-2xl font-semibold text-slate-900">Anwesenheits- &amp; Urlaubsstatistik</h2>
            <p className="text-sm text-slate-500">Zeitraum wählen, Reports exportieren und Monatsberichte erzeugen.</p>
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
              <label className="text-sm text-slate-600">Mitarbeiter:</label>
              <select
                className="input"
                value={selectedEmployeeId ?? ''}
                onChange={(e) => setSelectedEmployeeId(Number(e.target.value) || null)}
              >
                <option value="">Ich</option>
                {(employees ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.personnelNumber || emp.email})
                  </option>
                ))}
              </select>
            </>
          )}
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
          <button className="btn-primary" onClick={() => exportPdf({ employeeId: selectedEmployeeId })}>
            PDF Export
          </button>
          {hasRole('admin') && (
            <button
              className="btn-primary"
              onClick={() => exportPdf({ employeeId: selectedEmployeeId, orientation: 'landscape' })}
            >
              PDF Querformat
            </button>
          )}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
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
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';

type ResponsePayload = {
  ok: boolean;
  action: string;
  user?: { id: number; name: string };
  message?: string;
};

export function TerminalApp() {
  const defaultServerUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  const defaultApiKey = import.meta.env.VITE_API_KEY as string | undefined;
  const [rfid, setRfid] = useState('');
  const [result, setResult] = useState<{ action: 'CLOCK_IN' | 'CLOCK_OUT'; name: string } | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'idle' | 'success' | 'error' }>({
    message: 'Bitte RFID Chip scannen.',
    type: 'idle',
  });

  const normalizedServerUrl = useMemo(() => defaultServerUrl?.trim().replace(/\/$/, '') ?? '', [defaultServerUrl]);
  const normalizedApiKey = useMemo(() => defaultApiKey?.trim() ?? '', [defaultApiKey]);

  const submitEntry = async () => {
    if (!normalizedServerUrl || !normalizedApiKey) {
      setStatus({ message: 'Terminal ist nicht konfiguriert.', type: 'error' });
      return;
    }
    if (!rfid) {
      setStatus({ message: 'Bitte RFID Chip scannen.', type: 'error' });
      return;
    }
    setStatus({ message: 'Prüfe Status...', type: 'idle' });
    setResult(null);
    try {
      const statusResponse = await fetch(
        `${normalizedServerUrl}/api/terminals/status?rfid=${encodeURIComponent(rfid)}`,
        {
          headers: {
            'x-api-key': normalizedApiKey,
          },
        }
      );
      const statusData = (await statusResponse.json()) as {
        nextAction: 'CLOCK_IN' | 'CLOCK_OUT';
        user?: { name: string };
        message?: string;
      };
      if (!statusResponse.ok) {
        setStatus({ message: statusData.message ?? 'Status konnte nicht geprüft werden.', type: 'error' });
        return;
      }
      setStatus({ message: 'Buchung wird erfasst...', type: 'idle' });
      const response = await fetch(`${normalizedServerUrl}/api/terminals/entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': normalizedApiKey,
        },
        body: JSON.stringify({ rfid, type: statusData.nextAction }),
      });
      const data = (await response.json()) as ResponsePayload;
      if (!response.ok) {
        setStatus({ message: data.message ?? 'Fehler bei der Buchung.', type: 'error' });
        return;
      }
      const action = data.action === 'CLOCK_OUT' ? 'CLOCK_OUT' : 'CLOCK_IN';
      const name = data.user?.name ?? statusData.user?.name ?? '';
      setResult({ action, name });
      setStatus({
        message: 'Buchung erfolgreich.',
        type: 'success',
      });
      setRfid('');
    } catch (error) {
      setStatus({ message: 'Netzwerkfehler beim Senden.', type: 'error' });
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Erfassungsterminal</h1>
        <p className="subtitle">Bitte RFID Chip scannen.</p>

        <label htmlFor="rfid">RFID Chipnummer</label>
        <input
          id="rfid"
          type="text"
          placeholder="RFID"
          value={rfid}
          onChange={(event) => setRfid(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submitEntry();
            }
          }}
          autoFocus
        />

        <div className={`status ${status.type}`}>{status.message}</div>

        {result && (
          <div className={`result ${result.action === 'CLOCK_IN' ? 'in' : 'out'}`}>
            <span className="result-action">{result.action === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}</span>
            <span className="result-name">{result.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

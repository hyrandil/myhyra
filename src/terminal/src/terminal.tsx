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
  const [serverUrl, setServerUrl] = useState(defaultServerUrl ?? '');
  const [apiKey, setApiKey] = useState(defaultApiKey ?? '');
  const [rfid, setRfid] = useState('');
  const [action, setAction] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [status, setStatus] = useState<{ message: string; type: 'idle' | 'success' | 'error' }>({
    message: 'Bereit.',
    type: 'idle',
  });

  const normalizedServerUrl = useMemo(() => serverUrl.trim().replace(/\/$/, ''), [serverUrl]);

  const submitEntry = async () => {
    if (!normalizedServerUrl || !apiKey || !rfid) {
      setStatus({ message: 'Bitte Server URL, API Key und RFID eingeben.', type: 'error' });
      return;
    }
    setStatus({ message: 'Sende Buchung...', type: 'idle' });
    try {
      const response = await fetch(`${normalizedServerUrl}/api/terminals/entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ rfid, type: action }),
      });
      const data = (await response.json()) as ResponsePayload;
      if (!response.ok) {
        setStatus({ message: data.message ?? 'Fehler bei der Buchung.', type: 'error' });
        return;
      }
      setStatus({
        message: `${action === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}: ${data.user?.name ?? ''}`,
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
        <p>RFID scannen und eine Buchung an den Hauptserver senden.</p>

        <label htmlFor="serverUrl">Server URL</label>
        <input
          id="serverUrl"
          type="text"
          placeholder="https://api.example.com"
          value={serverUrl}
          onChange={(event) => setServerUrl(event.target.value)}
        />

        <label htmlFor="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          placeholder="API Key"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />

        <label htmlFor="rfid">RFID Chipnummer</label>
        <input
          id="rfid"
          type="text"
          placeholder="RFID"
          value={rfid}
          onChange={(event) => setRfid(event.target.value)}
        />

        <label htmlFor="action">Aktion</label>
        <select id="action" value={action} onChange={(event) => setAction(event.target.value as 'CLOCK_IN' | 'CLOCK_OUT')}>
          <option value="CLOCK_IN">Kommen</option>
          <option value="CLOCK_OUT">Gehen</option>
        </select>

        <button type="button" onClick={submitEntry}>
          Buchung senden
        </button>

        <div className={`status ${status.type}`}>{status.message}</div>
      </div>
    </div>
  );
}

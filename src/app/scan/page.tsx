'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface VerifyResponse {
  ok: boolean;
  item?: {
    itemCode: string;
    name: string;
    location?: { code: string | null } | null;
  };
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let isActive = true;
    let controls: Awaited<ReturnType<typeof reader.decodeFromVideoDevice>> | null = null;

    (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (!isActive) return;
          if (result) {
            setCode(result.getText());
          }
        });
      } catch (error) {
        console.error(error);
        setStatus('Kamera konnte nicht gestartet werden.');
      }
    })();

    return () => {
      isActive = false;
      controls?.stop();
    };
  }, []);

  async function handleVerify() {
    if (!code) return;
    setIsVerifying(true);
    setStatus(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        throw new Error('Serverfehler');
      }
      const data = (await response.json()) as VerifyResponse;
      if (!data.ok || !data.item) {
        setStatus('❌ Code wurde nicht gefunden.');
      } else {
        const location = data.item.location?.code ? `@ ${data.item.location.code}` : '';
        setStatus(`✔ ${data.item.name} ${location}`.trim());
      }
    } catch (error) {
      console.error(error);
      setStatus('Überprüfung fehlgeschlagen.');
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Barcode scannen</h1>
        <p className="mt-2 text-sm text-zinc-600">Nutze die Kamera zum Verifizieren von Karten während des Pick- oder Pack-Prozesses.</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-black/80 p-2 shadow-lg">
        <video ref={videoRef} className="h-72 w-full rounded-xl object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-40 rounded-xl border-2 border-white/70"></div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Erkannter Code</span>
          <p className="mt-2 text-lg font-medium text-zinc-900">{code || '—'}</p>
        </div>
        <button
          onClick={handleVerify}
          disabled={!code || isVerifying}
          className="w-full rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 md:w-48"
        >
          {isVerifying ? 'Wird geprüft…' : 'Verifizieren'}
        </button>
      </div>

      {status && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">{status}</div>
      )}
    </div>
  );
}

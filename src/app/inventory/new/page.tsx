'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ApiResponse {
  item: {
    itemCode: string;
    name: string;
  };
  barcodePngDataUrl: string;
}

export default function NewInventoryItemPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error ?? 'Speichern fehlgeschlagen');
      }

      const data = (await response.json()) as ApiResponse;
      setPreview(data.barcodePngDataUrl);
      setMessage(`Item ${data.item.itemCode} wurde angelegt.`);
      form.reset();
      window.open(`/labels/${data.item.itemCode}`, '_blank');
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Unbekannter Fehler');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Karte inventarisieren</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Erfasse neue Karten, ordne sie einem Lagerort zu und generiere direkt ein Barcode-Label.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span>Name *</span>
          <input
            name="name"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="Kartentitel"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Spiel *</span>
          <select
            name="game"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            defaultValue="YUGIOH"
          >
            <option value="YUGIOH">Yu-Gi-Oh!</option>
            <option value="POKEMON">Pokémon</option>
            <option value="ONEPIECE">One Piece</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Set</span>
          <input
            name="setName"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="Setname"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Kartennummer</span>
          <input
            name="number"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="z. B. BP01-DE012"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Sprache</span>
          <input
            name="language"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="DE, EN, ..."
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Zustand</span>
          <input
            name="condition"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="NM, LP, ..."
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Preis (Cent)</span>
          <input
            name="priceCents"
            type="number"
            min="0"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="123"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Location-Code</span>
          <input
            name="locationCode"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="z. B. A-03-12"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Wird gespeichert...' : 'Speichern & Barcode anzeigen'}
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-zinc-600">{message}</p>}

      {preview && (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium">Etikett-Vorschau</h2>
          <Image
            src={preview}
            alt="Barcode"
            width={320}
            height={120}
            sizes="100vw"
            unoptimized
            className="mt-4 w-full rounded-lg border border-zinc-100 bg-white"
          />
          <button
            className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900"
            onClick={() => window.print()}
          >
            Etikett drucken
          </button>
        </div>
      )}
    </div>
  );
}

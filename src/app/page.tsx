import Link from 'next/link';

const navigation = [
  {
    href: '/inventory/new',
    title: 'Inventarisieren',
    description: 'Neue Karten anlegen, Etiketten erzeugen und Lagerorte verwalten.',
  },
  {
    href: '/scan',
    title: 'Scan-Modus',
    description: 'Barcode-gestütztes Picken und Verifizieren von Bestellungen.',
  },
];

const resources = [
  {
    title: 'Bestellungen importieren',
    href: '/api/import-order',
    description: 'API-Endpunkt zum Hochladen von Cardmarket-PDFs und Anlegen der Pickliste.',
  },
  {
    title: 'Pickliste abrufen',
    href: '/api/picklist/{orderId}',
    description: 'Sortierte Reihenfolge der Positionen pro Bestellung.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">MyHyra</h1>
        <p className="text-lg text-zinc-600">
          Lager- und Versandverwaltung für Sammelkarten mit Barcode-gestützten Workflows.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold group-hover:text-zinc-900">{item.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <h2 className="text-lg font-medium">API-Endpunkte</h2>
        <ul className="mt-4 space-y-3 text-sm text-zinc-600">
          {resources.map((resource) => (
            <li key={resource.href}>
              <span className="font-medium text-zinc-900">{resource.title}:</span>{' '}
              <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{resource.href}</code>
              <span className="ml-2">{resource.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

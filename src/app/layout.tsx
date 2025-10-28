import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyHyra',
  description: 'Lager- und Versandverwaltung für Sammelkarten mit Barcode-gestützten Workflows.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}

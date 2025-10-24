import "../styles/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

import Providers from "../components/providers";

export const metadata: Metadata = {
  title: "Hyper-V Cloud Shop",
  description: "Book Hyper-V backed virtual machines"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

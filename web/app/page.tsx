import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="space-y-8">
      <section className="rounded-lg bg-white p-8 shadow">
        <h1 className="text-3xl font-semibold">Hyper-V Cloud Shop</h1>
        <p className="mt-2 text-slate-600">
          Provision Windows and Linux virtual machines across your Hyper-V fleet.
        </p>
        <div className="mt-6 flex gap-4">
          <Link className="rounded bg-indigo-600 px-4 py-2 text-white" href="/configure">
            Configure a VM
          </Link>
          <Link className="rounded border border-indigo-600 px-4 py-2 text-indigo-600" href="/admin/hosts">
            Admin Dashboard
          </Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Live Pricing", description: "Transparent pricing that updates as you configure." },
          { title: "Fleet Inventory", description: "See host capacity in real time." },
          { title: "Automated Provisioning", description: "Jobs are dispatched to Hyper-V agents automatically." }
        ].map((item) => (
          <article key={item.title} className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

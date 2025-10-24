"use client";

import axios from "axios";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  paymentProvider: string;
};

export default function AdminOrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios
      .get(`${baseUrl}/api/orders`, { headers: { Authorization: "Bearer placeholder" } })
      .then((res) => setOrders(res.data))
      .catch(() => setOrders([]));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-500">Overview of customer purchases and payment states.</p>
      </header>
      <div className="rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Order</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Provider</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Total</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-2 text-sm font-medium text-slate-700">{order.id}</td>
                <td className="px-4 py-2 text-sm text-slate-500">{order.status}</td>
                <td className="px-4 py-2 text-sm text-slate-500">{order.paymentProvider}</td>
                <td className="px-4 py-2 text-sm text-slate-500">
                  {(order.totalCents / 100).toFixed(2)} {order.currency}
                </td>
                <td className="px-4 py-2 text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-center text-sm text-slate-500" colSpan={5}>
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

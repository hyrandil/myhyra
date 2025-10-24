"use client";

import axios, { AxiosError } from "axios";
import { useEffect, useState } from "react";

import AdminLogin from "./admin-login";
import { useAuth } from "./auth-context";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  paymentProvider: string;
};

export default function AdminOrdersClient() {
  const { token, ready, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  useEffect(() => {
    if (!ready || !token) {
      if (ready) {
        setOrders([]);
      }
      return;
    }

    let cancelled = false;
    setError(null);
    axios
      .get<Order[]>(`${baseUrl}/api/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!cancelled) {
          setOrders(res.data);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        if (err instanceof AxiosError && err.response?.status === 401) {
          logout();
          setError("Session expired. Please sign in again.");
        } else {
          setError("Failed to load orders.");
        }
        setOrders([]);
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, logout, ready, token]);

  if (!ready) {
    return <p className="text-sm text-slate-500">Loading admin console…</p>;
  }

  if (!token) {
    return <AdminLogin />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-500">Overview of customer purchases and payment states.</p>
      </header>
      {error && <p className="rounded border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
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

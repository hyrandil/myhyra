import dynamic from "next/dynamic";

const AdminDashboard = dynamic(() => import("../../../components/admin/dashboard"), { ssr: false });

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}

import { AdminPageHeader, ComingSoon } from "@/components/admin/admin-shell";

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Overview" title="Dashboard" />
      <ComingSoon ticket="T9 (analytics and order queues)" />
    </>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { UserStatusBadges } from "@/components/admin/user-status";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { getActor } from "@/server/auth/session";
import { listUsersForAdmin, USER_STATUS_FILTERS, userListQuerySchema, type UserStatusFilter } from "@/server/dal/admin-users";

const STATUS_LABELS: Record<UserStatusFilter, string> = {
  all: "All users",
  active: "Active",
  unverified: "Email not verified",
  blocked: "Blocked",
  deleted: "Deleted",
};

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <AdminPageHeader
        eyebrow="Customers"
        title="Users"
        actions={
          <Link href="/admin/users/new" className={buttonClasses({ size: "sm" })}>
            Add user
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading users…</p>}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const query = userListQuerySchema.parse(await searchParams);
  const { rows, total, pageCount } = await listUsersForAdmin(await getActor(), query);
  const link = (patch: Partial<Record<keyof typeof query, string | number | null>>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...query, ...patch })) {
      if (v && v !== "all" && !(k === "page" && v === 1)) next.set(k, String(v));
    }
    const qs = next.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-3" action="/admin/users">
        <Input name="q" defaultValue={query.q} placeholder="Name or email" aria-label="Search users" className="max-w-64 py-2" />
        <Select name="status" defaultValue={query.status} aria-label="Status" className="max-w-52 py-2">
          {USER_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select name="role" defaultValue={query.role} aria-label="Role" className="max-w-40 py-2">
          <option value="all">Any role</option>
          <option value="user">Customers</option>
          <option value="admin">Admins</option>
        </Select>
        <button className={buttonClasses({ variant: "ghost", size: "sm" })}>Filter</button>
        <p className="ml-auto text-xs text-faint">
          {total} {total === 1 ? "user" : "users"}
        </p>
      </form>

      {rows.length === 0 ? (
        <p className="border border-dashed border-line p-10 text-center text-sm text-muted">No users match.</p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Spent</th>
                <th className="px-4 py-3">Live listings</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((user) => (
                <tr key={user.id} className="hover:bg-raised">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.id}`} className="text-champagne hover:text-gold hover:underline">
                      {user.name}
                    </Link>
                    <span className="block text-xs text-faint">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusBadges user={user} />
                  </td>
                  <td className="px-4 py-3 text-champagne">{user.orderCount}</td>
                  <td className="px-4 py-3 text-champagne">{formatNaira(user.spendKobo)}</td>
                  <td className="px-4 py-3 text-champagne">{user.liveListings}</td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 && (
        <nav className="flex items-center gap-3 text-xs text-muted" aria-label="Pages">
          {query.page > 1 && (
            <Link href={link({ page: query.page - 1 })} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              ← Previous
            </Link>
          )}
          Page {query.page} of {pageCount}
          {query.page < pageCount && (
            <Link href={link({ page: query.page + 1 })} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

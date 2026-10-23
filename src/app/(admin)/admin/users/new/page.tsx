import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { InviteUserForm } from "@/components/admin/invite-user-form";

export default function AdminNewUserPage() {
  return (
    <>
      <p className="mb-4 text-xs">
        <Link href="/admin/users" className="text-muted hover:text-gold">
          ← All users
        </Link>
      </p>
      <AdminPageHeader eyebrow="Users" title="Add a user" />
      <p className="mb-6 max-w-xl text-sm text-muted">
        Creates the account with the email already verified and emails them a link to set their password. Works even while
        public sign-ups are paused.
      </p>
      <InviteUserForm />
    </>
  );
}

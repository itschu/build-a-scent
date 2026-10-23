import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/domain";

type UserFlags = { role: UserRole; emailVerified: boolean; bannedAt: Date | null; deletedAt: Date | null };

function Badge({ tone, children }: { tone: "gold" | "danger" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide",
        tone === "gold" && "border-gold/50 text-gold",
        tone === "danger" && "border-danger/50 text-danger",
        tone === "muted" && "border-line text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Role and account-state badges for the admin users screens. */
export function UserStatusBadges({ user }: { user: UserFlags }) {
  if (user.deletedAt) return <Badge tone="muted">Deleted</Badge>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {user.role === "admin" && <Badge tone="gold">Admin</Badge>}
      {user.bannedAt ? <Badge tone="danger">Blocked</Badge> : <Badge tone="muted">Active</Badge>}
      {!user.emailVerified && <Badge tone="muted">Unverified</Badge>}
    </span>
  );
}

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { GUEST, type Actor, type SignedInActor } from "@/server/dal/actor";
import { getAuth } from "./index";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
};

function toRole(value: unknown): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : "user";
}

/**
 * The signed-in user for this request, or null. The session and role are read from the
 * database on every request (no cookie cache), so a role change applies immediately.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Read headers first: during prerendering this is where rendering stops.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    role: toRole((user as { role?: unknown }).role),
  };
});

export async function getActor(): Promise<Actor> {
  const user = await getSessionUser();
  if (!user) return GUEST;
  return { kind: "user", userId: user.id, role: user.role, emailVerified: user.emailVerified };
}

/** For pages and layouts: redirects guests to sign-in. */
export async function requireUser(returnTo?: string): Promise<SignedInActor> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    redirect(returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : "/sign-in");
  }
  return actor;
}

/** For admin pages and layouts: guests go to sign-in, signed-in non-admins go home. */
export async function requireAdmin(): Promise<SignedInActor> {
  const actor = await requireUser("/admin");
  if (actor.role !== "admin") redirect("/");
  return actor;
}

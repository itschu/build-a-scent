// Every DAL function receives the actor making the request and enforces the
// Authorization Rules from the Tech Plan itself; the browser never reaches the database.
import type { UserRole } from "@/lib/domain";

export type Actor =
  | { kind: "guest" }
  | { kind: "user"; userId: string; role: UserRole; emailVerified: boolean };

export type SignedInActor = Extract<Actor, { kind: "user" }>;

export const GUEST: Actor = { kind: "guest" };

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to do that") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function isAdmin(actor: Actor): boolean {
  return actor.kind === "user" && actor.role === "admin";
}

export function assertSignedIn(actor: Actor): asserts actor is SignedInActor {
  if (actor.kind !== "user") throw new AuthorizationError("Sign in required");
}

export function assertAdmin(actor: Actor): asserts actor is SignedInActor {
  if (!isAdmin(actor)) throw new AuthorizationError("Admin access required");
}

/** Owners and admins may read a user's private data; everyone else may not. */
export function assertOwnerOrAdmin(actor: Actor, ownerId: string): asserts actor is SignedInActor {
  assertSignedIn(actor);
  if (actor.userId !== ownerId && actor.role !== "admin") throw new AuthorizationError();
}

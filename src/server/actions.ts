import "server-only";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, NotFoundError, ValidationError } from "./dal/actor";

/**
 * Runs a Server Action body and turns expected failures into messages the UI can show.
 * Unexpected errors are logged and reported generically.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
    if (error instanceof ValidationError || error instanceof NotFoundError) return { ok: false, error: error.message };
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

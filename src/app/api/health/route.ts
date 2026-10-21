import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/server/db";

// Railway health check: the app is healthy only if it can reach Postgres.
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}

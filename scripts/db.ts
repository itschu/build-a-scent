// Database connection for CLI scripts. The app uses src/server/db instead, which is
// `server-only` and cannot be imported outside Next.js.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";

export function connect(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, schema, close: () => pool.end() };
}

export type ScriptDb = ReturnType<typeof connect>["db"];

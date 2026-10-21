import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

function createDb() {
  const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return drizzle({ client: pool, schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// One pool per process, reused across hot reloads in development. Created lazily so that
// importing this module (e.g. during `next build`) never needs a database.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}

export { schema };

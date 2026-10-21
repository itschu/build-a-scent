// Applies pending migrations from ./drizzle. Plain JavaScript so it runs in the production
// image (Railway pre-deploy command) without TypeScript tooling.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file; DATABASE_URL must come from the environment.
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.log("Migrations applied");
} finally {
  await pool.end();
}

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connect } from "../../scripts/db";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

/** Drops everything in the test database and applies all migrations from scratch. */
export async function freshTestDatabase() {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is not set");
  const connection = connect(testDatabaseUrl);
  await connection.db.execute(sql`drop schema if exists public cascade`);
  await connection.db.execute(sql`drop schema if exists drizzle cascade`);
  await connection.db.execute(sql`create schema public`);
  await migrate(connection.db, { migrationsFolder: "./drizzle" });
  return connection;
}

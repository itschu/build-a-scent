import { sql, type SQL } from "drizzle-orm";
import { timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** SQL fragment asserting that a text column holds one of a fixed set of values. */
export function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  const list = values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ");
  return sql`${column} in (${sql.raw(list)})`;
}

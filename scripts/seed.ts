// Usage: pnpm db:seed [--sample]   (--sample adds development ingredients)
import { connect } from "./db";
import { seed } from "./seed-data";

const { db, close } = connect();
try {
  const sampleData = process.argv.includes("--sample");
  await seed(db, { sampleData });
  console.log(`Seed complete${sampleData ? " (with sample ingredients)" : ""}`);
} finally {
  await close();
}

// Usage: pnpm db:seed [--ingredients] [--sample]
//   --ingredients  adds the starter ingredient catalogue (safe for production)
//   --sample       adds the starter ingredients plus demo shop products (development only)
import { connect } from "./db";
import { seed } from "./seed-data";

const { db, close } = connect();
try {
  const sampleData = process.argv.includes("--sample");
  const ingredients = process.argv.includes("--ingredients");
  await seed(db, { sampleData, ingredients });
  console.log(`Seed complete${sampleData ? " (with sample data)" : ingredients ? " (with starter ingredients)" : ""}`);
} finally {
  await close();
}

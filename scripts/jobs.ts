// Usage: pnpm jobs:run   (Railway cron service, every 5 minutes)
import "dotenv/config";
import { runAllJobs } from "@/server/jobs";

const results = await runAllJobs();
console.log(JSON.stringify({ at: new Date().toISOString(), ...results }));
const failed = Object.values(results).some((r) => typeof r === "object" && r !== null && "error" in r);
// Close the database pool so the process exits.
process.exit(failed ? 1 : 0);

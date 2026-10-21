// Usage: pnpm admin:promote --email you@example.com
import { connect } from "./db";
import { promoteToAdmin, UserNotFoundError } from "./admin";

const flag = process.argv.indexOf("--email");
const email = flag === -1 ? undefined : process.argv[flag + 1];
if (!email) {
  console.error("Usage: pnpm admin:promote --email <email>");
  process.exit(1);
}

const { db, close } = connect();
try {
  const user = await promoteToAdmin(db, email);
  console.log(`${user.email} is now an admin`);
} catch (error) {
  if (!(error instanceof UserNotFoundError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}

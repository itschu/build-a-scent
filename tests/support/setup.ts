import "dotenv/config";

// Server code reads DATABASE_URL; point it at the disposable test database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

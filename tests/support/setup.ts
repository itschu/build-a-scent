import "dotenv/config";

// Server code reads DATABASE_URL; point it at the disposable test database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Payments run against the in-memory simulator; webhook secrets are test values.
process.env.PAYMENTS_MODE = "fake";
process.env.PAYSTACK_SECRET_KEY ??= "sk_test_secret";
process.env.FLUTTERWAVE_SECRET_KEY ??= "FLWSECK_TEST-secret";
process.env.FLUTTERWAVE_WEBHOOK_HASH ??= "flw-test-hash";

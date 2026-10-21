export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Refuse to start with a bad environment rather than failing on the first request
    // that needs a missing variable.
    const { env } = await import("./env");
    try {
      env();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

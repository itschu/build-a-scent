import { connection } from "next/server";
import { getCachedPublicSettings } from "@/server/cached";

export async function GET() {
  // Served per request (from the settings cache), never baked in at build time.
  await connection();
  return Response.json(await getCachedPublicSettings());
}

import { getCachedPublicSettings } from "@/server/cached";

export async function GET() {
  return Response.json(await getCachedPublicSettings());
}

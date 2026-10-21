import { getActor } from "@/server/auth/session";
import { countUnreadNotifications, listNotifications } from "@/server/dal/notifications";

export async function GET() {
  const actor = await getActor();
  if (actor.kind !== "user") return Response.json({ error: "Sign in required" }, { status: 401 });
  const [unread, items] = await Promise.all([countUnreadNotifications(actor), listNotifications(actor)]);
  return Response.json({ unread, items }, { headers: { "Cache-Control": "no-store" } });
}

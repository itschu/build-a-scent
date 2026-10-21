import { ZodError } from "zod";
import { getActor } from "@/server/auth/session";
import { setCheckoutContext } from "@/server/checkout/context";
import { initiateCheckout } from "@/server/checkout/initiate";
import { ValidationError } from "@/server/dal/actor";
import { checkLimits, clientIp, LIMITS, tooManyRequests } from "@/server/rate-limit";

export async function POST(request: Request) {
  const limited = await checkLimits([{ key: `checkout:ip:${clientIp(request.headers)}`, ...LIMITS.checkoutPerIp }]);
  if (!limited.allowed) return tooManyRequests(limited, "Too many checkout attempts. Please wait a few minutes and try again.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const result = await initiateCheckout(await getActor(), body as never);
    if (result.kind === "changed") return Response.json({ changed: true, issues: result.issues }, { status: 409 });
    await setCheckoutContext(result.orderId);
    return Response.json({ orderNumber: result.orderNumber, paymentUrl: result.paymentUrl });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 422 });
    console.error(error);
    return Response.json({ error: "Something went wrong starting checkout. Please try again." }, { status: 500 });
  }
}

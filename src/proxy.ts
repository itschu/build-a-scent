import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: redirects visitors with no session cookie away from signed-in
// areas. The real check (session + role from the database) happens in layouts, Server
// Actions and Route Handlers.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/library/:path*", "/account/:path*", "/admin/:path*", "/marketplace/list/:path*"],
};

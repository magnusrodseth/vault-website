import { getIronSession } from "iron-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { type SessionData, sessionOptions } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Allow login page
  if (request.nextUrl.pathname.startsWith("/login")) {
    return response;
  }

  // Allow API auth route
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return response;
  }

  // Allow static files
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/favicon") ||
    request.nextUrl.pathname.endsWith(".json") ||
    request.nextUrl.pathname.endsWith(".png") ||
    request.nextUrl.pathname.endsWith(".ico")
  ) {
    return response;
  }

  // Check session
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions,
  );

  // Protect everything else
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

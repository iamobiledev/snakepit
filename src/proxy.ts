import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight request proxy — auth enforcement for /app happens in Server
 * Components via requireSession. This only adds security headers and
 * keeps public routes cache-friendly.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Public document pages can be cached at the edge when safe
  if (request.nextUrl.pathname.startsWith("/p/")) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};

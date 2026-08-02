import { type NextRequest, NextResponse } from "next/server";

const PRIVATE_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Overwrite client input with the trusted route, including its exact query string.
  requestHeaders.set(
    "x-peated-request-path",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (request.cookies.has("_session")) {
    response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  }

  if (request.nextUrl.pathname === "/oauth/authorize") {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|uploads|.*\\..*).*)",
    "/sitemap.xml",
    "/sitemaps/:path*",
  ],
};

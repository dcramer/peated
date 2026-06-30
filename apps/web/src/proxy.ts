import { type NextRequest, NextResponse } from "next/server";

const PRIVATE_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (request.cookies.has("_session")) {
    response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
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

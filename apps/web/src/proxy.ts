import { isORPCNotFoundError } from "@peated/orpc/client/errors";
import {
  getBottleRouteRedirect,
  getLocationRouteRedirect,
  getSeriesRouteRedirect,
  matchBottleRoute,
  matchLocationRoute,
  matchSeriesRoute,
} from "@peated/web/lib/catalogPageRoutes";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import {
  matchEntityRoute,
  type PeatedIdRouteResolution,
  resolveEntityRoute,
} from "@peated/web/lib/peatedIdRoutes";
import {
  getTastingRouteRedirect,
  matchTastingRoute,
} from "@peated/web/lib/tastingRoutes";
import { type NextRequest, NextResponse } from "next/server";

const PRIVATE_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Overwrite client input with the trusted route, including its exact query string.
  requestHeaders.set(
    "x-peated-request-path",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const entityMatch = matchEntityRoute(request.nextUrl.pathname);
  const tastingMatch = matchTastingRoute(request.nextUrl.pathname);
  const seriesMatch = matchSeriesRoute(request.nextUrl.pathname);
  const bottleMatch = matchBottleRoute(request.nextUrl.pathname);
  const locationMatch = matchLocationRoute(request.nextUrl.pathname);
  const legacySeriesMatch = seriesMatch?.slug === null ? seriesMatch : null;
  const legacyBottleMatch = bottleMatch?.slug === null ? bottleMatch : null;
  const locationNeedsRedirect =
    locationMatch &&
    (locationMatch.countrySlug !== locationMatch.countrySlug.toLowerCase() ||
      (locationMatch.regionSlug !== null &&
        locationMatch.regionSlug !== locationMatch.regionSlug.toLowerCase()));
  let resolution: PeatedIdRouteResolution | null = null;

  if (entityMatch) {
    try {
      const { client } = await createAnonymousServerClient();
      const entity = await client.entities.resolve({
        entity: entityMatch.entityId,
      });
      resolution = resolveEntityRoute(entityMatch, entity);
    } catch (error) {
      if (!isORPCNotFoundError(error)) throw error;
      resolution = null;
    }
  }
  if (tastingMatch) {
    try {
      // Tasting privacy permits proxy redirects only for anonymously visible records.
      // Authorized private requests are handled by the page's session-aware loader.
      const { client } = await createAnonymousServerClient();
      const tasting = await client.tastings.details({
        tasting: tastingMatch.id,
      });
      const pathname = getTastingRouteRedirect(tastingMatch, tasting);
      if (pathname) resolution = { action: "redirect", pathname };
    } catch (error) {
      if (!isORPCNotFoundError(error)) throw error;
    }
  }
  if (legacyBottleMatch || legacySeriesMatch || locationNeedsRedirect) {
    try {
      // Web performance: normal slug URLs use the page's memoized identity read.
      // Only legacy IDs and location casing need a lookup before rendering.
      const { client } = await createAnonymousServerClient();
      let pathname: string | null;
      if (legacyBottleMatch) {
        const bottle = await client.bottles.details({
          bottle: legacyBottleMatch.id,
        });
        pathname = getBottleRouteRedirect(legacyBottleMatch, bottle);
      } else if (legacySeriesMatch) {
        const series = await client.bottleSeries.details({
          series: legacySeriesMatch.id,
        });
        pathname = getSeriesRouteRedirect(legacySeriesMatch, series);
      } else if (locationMatch) {
        const country = await client.countries.details({
          country: locationMatch.countrySlug,
        });
        const location = locationMatch.regionSlug
          ? await client.regions.details({
              country: country.slug,
              region: locationMatch.regionSlug,
            })
          : country;
        pathname = getLocationRouteRedirect(locationMatch, location);
      } else {
        pathname = null;
      }
      resolution = pathname ? { action: "redirect", pathname } : null;
    } catch (error) {
      if (!isORPCNotFoundError(error)) throw error;
      resolution = null;
    }
  }
  let response: NextResponse;

  if (resolution) {
    const destination = request.nextUrl.clone();
    destination.pathname = resolution.pathname;
    if (resolution.action === "redirect") {
      destination.searchParams.delete("_rsc");
    }
    response =
      resolution.action === "redirect"
        ? NextResponse.redirect(destination, 308)
        : NextResponse.rewrite(destination, {
            request: { headers: requestHeaders },
          });
  } else {
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

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
    "/tastings/:path*",
    "/series/:path*",
    "/bottles/:path*",
    "/locations/:path*",
  ],
};

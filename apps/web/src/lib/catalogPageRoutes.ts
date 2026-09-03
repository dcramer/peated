import { parsePeatedId } from "@peated/server/lib/peatedId";
import {
  getBottleSeriesUrl,
  getBottleUrl,
  getCountryUrl,
  getRegionUrl,
} from "./urls";

export function matchBottleRoute(pathname: string) {
  const shortId = /^\/([Bb]\d+)\/?$/.exec(pathname);
  if (shortId) {
    const parsed = parsePeatedId(shortId[1]);
    return parsed?.type === "bottle"
      ? { id: parsed.id, pathname, suffix: "" }
      : null;
  }
  // Web routing keeps removed bottle pages as direct 404s.
  const match =
    /^\/bottles\/([1-9]\d*)(?:-[^/]+)?(\/(?:aliases|tastings|similar|prices|releases|edit|audit|merge|addTasting|addRelease)\/?|\/)?$/.exec(
      pathname,
    );
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return { id: Number(match[1]), pathname, suffix: match[2] ?? "" };
}

export function getBottleRouteRedirect(
  match: NonNullable<ReturnType<typeof matchBottleRoute>>,
  bottle: Parameters<typeof getBottleUrl>[0],
) {
  return getRedirectPath(
    match.pathname,
    `${getBottleUrl(bottle)}${match.suffix}`,
  );
}

export function matchSeriesRoute(pathname: string) {
  const shortId = /^\/([Ss]\d+)\/?$/.exec(pathname);
  if (shortId) {
    const parsed = parsePeatedId(shortId[1]);
    return parsed?.type === "series"
      ? { id: parsed.id, pathname, suffix: "" }
      : null;
  }
  const match = /^\/series\/([1-9]\d*)(?:-[^/]+)?(\/.*)?$/.exec(pathname);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return { id: Number(match[1]), pathname, suffix: match[2] ?? "" };
}

export function getSeriesRouteRedirect(
  match: NonNullable<ReturnType<typeof matchSeriesRoute>>,
  series: Parameters<typeof getBottleSeriesUrl>[0],
) {
  return getRedirectPath(
    match.pathname,
    `${getBottleSeriesUrl(series)}${match.suffix}`,
  );
}

export function matchLocationRoute(pathname: string) {
  const match = /^\/locations\/([^/]+)(?:\/regions\/([^/]+))?(\/.*)?$/.exec(
    pathname,
  );
  if (!match || match[1] === "all-regions") return null;
  try {
    return {
      countrySlug: decodeURIComponent(match[1]),
      regionSlug: match[2] ? decodeURIComponent(match[2]) : null,
      pathname,
      suffix: match[3] ?? "",
    };
  } catch {
    return null;
  }
}

export function getLocationRouteRedirect(
  match: NonNullable<ReturnType<typeof matchLocationRoute>>,
  location: { slug: string; country?: { slug: string } },
) {
  const path = location.country
    ? getRegionUrl({ slug: location.slug, country: location.country })
    : getCountryUrl(location);
  return getRedirectPath(match.pathname, `${path}${match.suffix}`);
}

function getRedirectPath(pathname: string, canonicalPath: string) {
  return pathname === canonicalPath || pathname === encodeURI(canonicalPath)
    ? null
    : canonicalPath;
}

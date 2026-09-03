import { getTastingUrl } from "./urls";

export function matchTastingRoute(pathname: string) {
  const match = /^\/tastings\/([1-9]\d*)(?:-[^/]+)?(\/.*)?$/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id)) return null;
  return { id, pathname, suffix: match[2] ?? "" };
}

export function getTastingRouteRedirect(
  match: NonNullable<ReturnType<typeof matchTastingRoute>>,
  tasting: Parameters<typeof getTastingUrl>[0],
) {
  const canonicalPath = `${getTastingUrl(tasting)}${match.suffix}`;
  return match.pathname === canonicalPath ||
    match.pathname === encodeURI(canonicalPath)
    ? null
    : canonicalPath;
}

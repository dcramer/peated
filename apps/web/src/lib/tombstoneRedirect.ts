import { headers } from "next/headers";

type CanonicalRouteRedirectOptions = {
  canonicalId: number | string;
  collectionPath: `/${string}`;
  currentId: number | string;
};

function getRequestedPathname() {
  // Next forwards the rendered request path to app routes via x-invoke-path.
  const pathname = headers().get("x-invoke-path") ?? headers().get("next-url");

  if (!pathname) {
    return null;
  }

  try {
    return new URL(pathname, "http://n").pathname;
  } catch {
    return null;
  }
}

export function getCanonicalRouteRedirectPath({
  canonicalId,
  collectionPath,
  currentId,
}: CanonicalRouteRedirectOptions) {
  const currentPrefix = `${collectionPath}/${currentId}`;
  const canonicalPrefix = `${collectionPath}/${canonicalId}`;
  const requestedPathname = getRequestedPathname();

  if (!requestedPathname) {
    return `${canonicalPrefix}/`;
  }

  const suffix = requestedPathname.slice(currentPrefix.length);
  if (
    !requestedPathname.startsWith(currentPrefix) ||
    (suffix && !suffix.startsWith("/"))
  ) {
    return `${canonicalPrefix}/`;
  }

  return `${canonicalPrefix}${suffix || "/"}`;
}

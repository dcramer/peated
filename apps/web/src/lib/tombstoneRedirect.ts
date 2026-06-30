import { headers } from "next/headers";

type CanonicalRouteRedirectOptions = {
  canonicalId: number | string;
  collectionPath: `/${string}`;
  currentId: number | string;
};

async function getRequestedPathname() {
  // Next forwards the rendered request path to app routes via x-invoke-path.
  const reqHeaders = await headers();
  const pathname =
    reqHeaders.get("x-invoke-path") ?? reqHeaders.get("next-url");

  if (!pathname) {
    return null;
  }

  try {
    return new URL(pathname, "http://n").pathname;
  } catch {
    return null;
  }
}

export async function getCanonicalRouteRedirectPath({
  canonicalId,
  collectionPath,
  currentId,
}: CanonicalRouteRedirectOptions) {
  const currentPrefix = `${collectionPath}/${currentId}`;
  const canonicalPrefix = `${collectionPath}/${canonicalId}`;
  const requestedPathname = await getRequestedPathname();

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

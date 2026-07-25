import { headers } from "next/headers";
import { getReleaseFamilyHref } from "./releaseFamily";

type CanonicalRouteRedirectOptions = {
  canonicalId: number | string;
  collectionPath: `/${string}`;
  currentId: number | string;
};

type RequestedRoute = {
  pathname: string;
  search: string;
};

function parseRequestedRoute(value: string): RequestedRoute {
  try {
    if (!value.startsWith("/") || value.startsWith("//")) {
      throw new Error("Request path must be relative to the Peated origin");
    }

    const url = new URL(value, "http://n");
    return { pathname: url.pathname, search: url.search };
  } catch (error) {
    throw new Error("Invalid proxy-owned request path", { cause: error });
  }
}

async function getRequestedRoute() {
  const reqHeaders = await headers();
  const requestPath = reqHeaders.get("x-peated-request-path");

  if (!requestPath) {
    return null;
  }

  return parseRequestedRoute(requestPath);
}

export async function getCanonicalRouteRedirectPath({
  canonicalId,
  collectionPath,
  currentId,
}: CanonicalRouteRedirectOptions) {
  const currentPrefix = `${collectionPath}/${currentId}`;
  const canonicalPrefix = `${collectionPath}/${canonicalId}`;
  const requestedRoute = await getRequestedRoute();

  if (!requestedRoute) {
    return `${canonicalPrefix}/`;
  }

  const { pathname: requestedPathname, search } = requestedRoute;
  const suffix = requestedPathname.slice(currentPrefix.length);
  if (
    !requestedPathname.startsWith(currentPrefix) ||
    (suffix && !suffix.startsWith("/"))
  ) {
    return `${canonicalPrefix}/${search}`;
  }

  return `${canonicalPrefix}${suffix || "/"}${search}`;
}

export async function getReleaseFamilyRouteRedirectPath(
  representativeBottleId: number,
) {
  const requestedRoute = await getRequestedRoute();
  return getReleaseFamilyHref(
    representativeBottleId,
    requestedRoute?.search ?? "",
  );
}

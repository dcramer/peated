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

type CanonicalPublicRouteOptions = {
  canonicalId: number;
  canonicalPath: `/${string}`;
  currentId: number;
  currentPathPrefixes: `/${string}`[];
};

export type LoadRequestHeaders = () => Promise<Pick<Headers, "get">>;

const loadRequestHeaders: LoadRequestHeaders = headers;

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

async function getRequestedRoute(loadHeaders: LoadRequestHeaders) {
  const reqHeaders = await loadHeaders();
  const requestPath = reqHeaders.get("x-peated-request-path");

  if (!requestPath) {
    return null;
  }

  return parseRequestedRoute(requestPath);
}

export async function getCanonicalPublicRouteRedirectPath(
  {
    canonicalId,
    canonicalPath,
    currentId,
    currentPathPrefixes,
  }: CanonicalPublicRouteOptions,
  loadHeaders: LoadRequestHeaders = loadRequestHeaders,
) {
  const requestedRoute = await getRequestedRoute(loadHeaders);

  if (!requestedRoute) {
    return canonicalId === currentId ? null : `${canonicalPath}/`;
  }

  const { pathname, search } = requestedRoute;
  if (pathname === canonicalPath || pathname.startsWith(`${canonicalPath}/`)) {
    return null;
  }

  const currentPrefix = currentPathPrefixes.find((prefix) => {
    const suffix = pathname.slice(prefix.length);
    return pathname.startsWith(prefix) && (!suffix || suffix.startsWith("/"));
  });
  const suffix = currentPrefix ? pathname.slice(currentPrefix.length) : "";
  return `${canonicalPath}${suffix || "/"}${search}`;
}

export async function getCanonicalRouteRedirectPath(
  { canonicalId, collectionPath, currentId }: CanonicalRouteRedirectOptions,
  loadHeaders: LoadRequestHeaders = loadRequestHeaders,
) {
  const currentPrefix = `${collectionPath}/${currentId}`;
  const canonicalPrefix = `${collectionPath}/${canonicalId}`;
  const requestedRoute = await getRequestedRoute(loadHeaders);

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
  loadHeaders: LoadRequestHeaders = loadRequestHeaders,
) {
  const requestedRoute = await getRequestedRoute(loadHeaders);
  return getReleaseFamilyHref(
    representativeBottleId,
    requestedRoute?.search ?? "",
  );
}

import { headers } from "next/headers";

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
    return { pathname: decodeURI(url.pathname), search: url.search };
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

function getNestedRouteSuffix(pathname: string, prefix: string) {
  if (pathname === prefix) return "";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  if (!pathname.startsWith(`${prefix}-`)) return null;

  const nestedRouteIndex = pathname.indexOf("/", prefix.length + 1);
  return nestedRouteIndex === -1 ? "" : pathname.slice(nestedRouteIndex);
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
    return canonicalId === currentId ? null : canonicalPath;
  }

  const { pathname, search } = requestedRoute;
  if (pathname === canonicalPath || pathname.startsWith(`${canonicalPath}/`)) {
    return null;
  }

  const suffix =
    currentPathPrefixes
      .map((prefix) => getNestedRouteSuffix(pathname, prefix))
      .find((candidate) => candidate !== null) ?? "";
  return `${canonicalPath}${suffix}${search}`;
}

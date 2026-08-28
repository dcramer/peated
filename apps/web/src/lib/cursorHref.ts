import type { SearchParamSource } from "./apiQueryParams";

export function buildSearchHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getCursorHref(
  pathname: string,
  searchParams: SearchParamSource,
  cursor: number | string | null | undefined,
  updates: Record<string, number | string> = {},
) {
  if (cursor === null || cursor === undefined || cursor === "")
    return undefined;

  const nextParams = toURLSearchParams(searchParams);
  nextParams.set("cursor", String(cursor));
  Object.entries(updates).forEach(([name, value]) =>
    nextParams.set(name, String(value)),
  );
  return buildSearchHref(pathname, nextParams);
}

function toURLSearchParams(searchParams: SearchParamSource) {
  if (Symbol.iterator in searchParams) {
    return new URLSearchParams([...searchParams]);
  }

  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(name, item));
    } else if (value !== undefined) {
      params.set(name, value);
    }
  });
  return params;
}

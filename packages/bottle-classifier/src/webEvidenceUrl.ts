const TRACKING_QUERY_PARAMETER_NAMES = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "srsltid",
]);

export function canonicalizeWebEvidenceUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";

  for (const name of Array.from(parsed.searchParams.keys())) {
    const normalizedName = name.toLowerCase();
    if (
      normalizedName.startsWith("utm_") ||
      TRACKING_QUERY_PARAMETER_NAMES.has(normalizedName)
    ) {
      parsed.searchParams.delete(name);
    }
  }

  parsed.searchParams.sort();
  return parsed.toString();
}

export function webEvidenceUrlsMatch(left: string, right: string): boolean {
  const leftUrl = new URL(canonicalizeWebEvidenceUrl(left));
  const rightUrl = new URL(canonicalizeWebEvidenceUrl(right));

  return webEvidenceUrlKey(leftUrl) === webEvidenceUrlKey(rightUrl);
}

function webEvidenceUrlKey(url: URL): string {
  const host = url.host.toLowerCase().replace(/^www\./, "");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return `${host}${pathname}${url.search}`;
}

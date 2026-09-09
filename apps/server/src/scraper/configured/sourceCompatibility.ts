type SourceCompatibility = {
  matches(url: URL): boolean;
  detailPageUrl?(url: URL): URL;
  publishedDateFromUrl?(url: URL): Date | null;
};

function createDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

const SOURCE_COMPATIBILITY: SourceCompatibility[] = [
  {
    matches: (url) => url.hostname === "shop.theglenallachie.com",
    detailPageUrl: (url) => {
      if (url.pathname.startsWith("/products/")) {
        url.searchParams.set("country", "GB");
      }
      return url;
    },
  },
  {
    matches: (url) => url.hostname.endsWith("whiskyfun.com"),
    publishedDateFromUrl: (url) => {
      const compact = url.pathname.match(
        /(?:^|\D)(\d{2})(\d{2})(\d{2})(?:\D|$)/u,
      );
      return compact
        ? createDate(
            2000 + Number(compact[3]),
            Number(compact[1]),
            Number(compact[2]),
          )
        : null;
    },
  },
];

export function applyDetailPageUrlCompatibility(url: URL) {
  const compatibility = SOURCE_COMPATIBILITY.find((candidate) =>
    candidate.matches(url),
  );
  return compatibility?.detailPageUrl?.(url) ?? url;
}

export function readCompatiblePublishedDate(url: URL) {
  const compatibility = SOURCE_COMPATIBILITY.find((candidate) =>
    candidate.matches(url),
  );
  return compatibility?.publishedDateFromUrl?.(url) ?? null;
}

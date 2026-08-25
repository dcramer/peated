import { parsePeatedId } from "@peated/server/lib/peatedId";

export type PeatedIdRouteResolution = {
  action: "redirect" | "rewrite";
  pathname: string;
};

const ROOT_PEATED_ID_PATTERN = /^\/([BE]\d+)\/?$/i;
const LEGACY_BOTTLE_PATTERN = /^\/bottles\/([1-9]\d*)\/?$/;
const LEGACY_ENTITY_PATTERN = /^\/entities\/([1-9]\d*)\/?$/;

export function resolvePeatedIdRoute(
  pathname: string,
): PeatedIdRouteResolution | null {
  const rootMatch = ROOT_PEATED_ID_PATTERN.exec(pathname);
  if (rootMatch) {
    const parsed = parsePeatedId(rootMatch[1]);
    if (!parsed) return null;

    const canonicalPath = `/${parsed.peatedId}`;
    if (pathname !== canonicalPath) {
      return { action: "redirect", pathname: canonicalPath };
    }

    return {
      action: "rewrite",
      pathname:
        parsed.type === "bottle"
          ? `/bottles/${parsed.id}`
          : `/entities/${parsed.id}`,
    };
  }

  const bottleMatch = LEGACY_BOTTLE_PATTERN.exec(pathname);
  if (bottleMatch) {
    const parsed = parsePeatedId(`B${bottleMatch[1]}`);
    if (!parsed) return null;
    return {
      action: "redirect",
      pathname: `/${parsed.peatedId}`,
    };
  }

  const entityMatch = LEGACY_ENTITY_PATTERN.exec(pathname);
  if (entityMatch) {
    const parsed = parsePeatedId(`E${entityMatch[1]}`);
    if (!parsed) return null;
    return {
      action: "redirect",
      pathname: `/${parsed.peatedId}`,
    };
  }

  return null;
}

import { parsePeatedId } from "@peated/server/lib/peatedId";

export type PeatedIdRouteResolution = {
  action: "redirect" | "rewrite";
  pathname: string;
};

const ROOT_PEATED_ID_PATTERN = /^\/([BE]\d+)\/?$/i;
const PUBLIC_ENTITY_PATTERN =
  /^\/(brands|distillers|bottlers|blenders|companies)\/([1-9]\d*)(\/.*)?$/;

export function resolvePeatedIdRoute(
  pathname: string,
): PeatedIdRouteResolution | null {
  const rootMatch = ROOT_PEATED_ID_PATTERN.exec(pathname);
  if (rootMatch) {
    const parsed = parsePeatedId(rootMatch[1]);
    if (!parsed) return null;

    return {
      action: parsed.type === "bottle" ? "redirect" : "rewrite",
      pathname:
        parsed.type === "bottle"
          ? `/bottles/${parsed.id}`
          : `/entities/${parsed.id}`,
    };
  }

  const entityMatch = PUBLIC_ENTITY_PATTERN.exec(pathname);
  if (entityMatch) {
    return {
      action: "rewrite",
      pathname: `/entities/${entityMatch[2]}${entityMatch[3] ?? ""}`,
    };
  }

  return null;
}

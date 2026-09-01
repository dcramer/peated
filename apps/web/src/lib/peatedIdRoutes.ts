import { parsePeatedId } from "@peated/server/lib/peatedId";
import type { EntityKind } from "@peated/server/types";
import { getEntityUrl } from "./urls";

export type PeatedIdRouteResolution = {
  action: "redirect" | "rewrite";
  pathname: string;
};

const ROOT_PEATED_ID_PATTERN = /^\/([BES]\d+)\/?$/i;
const PUBLIC_ENTITY_PATTERN =
  /^\/(brands|distillers|bottlers|companies)\/([1-9]\d*)(?:-[^/]+)?(\/.*)?$/;
const LEGACY_ENTITY_PATTERN = /^\/entities\/([1-9]\d*)(?:-[^/]+)?(\/.*)?$/;

export type EntityRouteMatch = {
  entityId: number;
  kind: EntityKind | null;
  pathname: string;
  source: "collection" | "legacy" | "peated-id";
  suffix: string;
};

function normalizeSuffix(suffix?: string) {
  return suffix === "/" ? "" : (suffix ?? "");
}

function parseEntityId(value: string): number | null {
  const entityId = Number(value);
  return Number.isSafeInteger(entityId) && entityId > 0 ? entityId : null;
}

function getEntityKind(collection: string): EntityKind | null {
  switch (collection) {
    case "brands":
      return "brand";
    case "distillers":
      return "distillery";
    case "bottlers":
      return "bottler";
    case "companies":
      return "company";
    default:
      return null;
  }
}

export function resolveCatalogPeatedIdRoute(
  pathname: string,
): PeatedIdRouteResolution | null {
  const rootMatch = ROOT_PEATED_ID_PATTERN.exec(pathname);
  if (rootMatch) {
    const parsed = parsePeatedId(rootMatch[1]);
    if (!parsed) return null;

    if (parsed.type === "bottle") {
      return { action: "redirect", pathname: `/bottles/${parsed.id}` };
    }
    if (parsed.type === "series") {
      return { action: "redirect", pathname: `/series/${parsed.id}` };
    }
    return null;
  }

  return null;
}

export function matchEntityRoute(pathname: string): EntityRouteMatch | null {
  const rootMatch = ROOT_PEATED_ID_PATTERN.exec(pathname);
  if (rootMatch) {
    const parsed = parsePeatedId(rootMatch[1]);
    if (parsed?.type !== "entity") return null;

    return {
      entityId: parsed.id,
      kind: null,
      pathname,
      source: "peated-id",
      suffix: "",
    };
  }

  const entityMatch = PUBLIC_ENTITY_PATTERN.exec(pathname);
  if (entityMatch) {
    const entityId = parseEntityId(entityMatch[2]);
    const kind = getEntityKind(entityMatch[1]);
    if (!entityId || !kind) return null;
    const suffix = normalizeSuffix(entityMatch[3]);

    return {
      entityId,
      kind,
      pathname: suffix ? pathname.slice(0, -suffix.length) : pathname,
      source: "collection",
      suffix,
    };
  }

  const legacyMatch = LEGACY_ENTITY_PATTERN.exec(pathname);
  if (legacyMatch) {
    const entityId = parseEntityId(legacyMatch[1]);
    if (!entityId) return null;
    const suffix = normalizeSuffix(legacyMatch[2]);

    return {
      entityId,
      kind: null,
      pathname: suffix ? pathname.slice(0, -suffix.length) : pathname,
      source: "legacy",
      suffix,
    };
  }

  return null;
}

export function resolveEntityRoute(
  match: EntityRouteMatch,
  entity: { id: number; kind: EntityKind; name: string },
): PeatedIdRouteResolution {
  const suffix = match.suffix;
  const canonicalPath = getEntityUrl(entity);
  const canonicalRequest =
    match.source === "collection" &&
    match.entityId === entity.id &&
    match.kind === entity.kind &&
    match.pathname === canonicalPath;

  return canonicalRequest
    ? {
        action: "rewrite",
        pathname: `/entities/${entity.id}${suffix}`,
      }
    : { action: "redirect", pathname: `${canonicalPath}${suffix}` };
}

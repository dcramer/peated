import { parsePeatedId } from "@peated/server/lib/peatedId";
import type { EntityKind } from "@peated/server/types";
import { getEntityUrl } from "./urls";

export type PeatedIdRouteResolution = {
  action: "redirect" | "rewrite";
  pathname: string;
};

const ROOT_PEATED_ID_PATTERN = /^\/([BE]\d+)\/?$/i;
const PUBLIC_ENTITY_PATTERN =
  /^\/(brands|distillers|bottlers|companies)\/([1-9]\d*)(\/.*)?$/;
const LEGACY_ENTITY_PATTERN = /^\/entities\/([1-9]\d*)(\/.*)?$/;

export type EntityRouteMatch = {
  entityId: number;
  kind: EntityKind | null;
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

export function resolveBottlePeatedIdRoute(
  pathname: string,
): PeatedIdRouteResolution | null {
  const rootMatch = ROOT_PEATED_ID_PATTERN.exec(pathname);
  if (rootMatch) {
    const parsed = parsePeatedId(rootMatch[1]);
    if (!parsed) return null;

    return parsed.type === "bottle"
      ? { action: "redirect", pathname: `/bottles/${parsed.id}` }
      : null;
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
      source: "peated-id",
      suffix: "",
    };
  }

  const entityMatch = PUBLIC_ENTITY_PATTERN.exec(pathname);
  if (entityMatch) {
    const entityId = parseEntityId(entityMatch[2]);
    const kind = getEntityKind(entityMatch[1]);
    if (!entityId || !kind) return null;

    return {
      entityId,
      kind,
      source: "collection",
      suffix: normalizeSuffix(entityMatch[3]),
    };
  }

  const legacyMatch = LEGACY_ENTITY_PATTERN.exec(pathname);
  if (legacyMatch) {
    const entityId = parseEntityId(legacyMatch[1]);
    if (!entityId) return null;

    return {
      entityId,
      kind: null,
      source: "legacy",
      suffix: normalizeSuffix(legacyMatch[2]),
    };
  }

  return null;
}

export function resolveEntityRoute(
  match: EntityRouteMatch,
  entity: { id: number; kind: EntityKind },
): PeatedIdRouteResolution {
  const suffix = match.suffix;
  const canonicalPath = `${getEntityUrl(entity)}${suffix}`;
  const canonicalRequest =
    match.source === "collection" &&
    match.entityId === entity.id &&
    match.kind === entity.kind;

  return canonicalRequest
    ? {
        action: "rewrite",
        pathname: `/entities/${entity.id}${suffix}`,
      }
    : { action: "redirect", pathname: canonicalPath };
}

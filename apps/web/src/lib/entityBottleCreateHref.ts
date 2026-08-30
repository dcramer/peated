import type { EntityKind } from "@peated/server/types";

import { getEntityUrl } from "./urls";

export function getEntityBottleCreateHref({
  id,
  kind,
}: {
  id: number;
  kind: EntityKind | null;
}) {
  const params = new URLSearchParams({ returnTo: getEntityUrl({ id, kind }) });

  switch (kind) {
    case "brand":
      params.set("brand", String(id));
      break;
    case "bottler":
      params.set("bottler", String(id));
      break;
    case "distillery":
      params.set("distiller", String(id));
      break;
    case "blender":
    case "company":
    case null:
      return undefined;
  }

  return `/bottles/new?${params.toString()}`;
}

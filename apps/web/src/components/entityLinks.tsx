import type { EntityKind } from "@peated/server/types";

import { TextLink } from "@peated/web/components/designSystem/components";
import { getEntityUrl } from "@peated/web/lib/urls";

import Join from "./join";

type LinkedEntity = {
  id: number;
  kind: EntityKind | null;
  name: string;
};

export function EntityLinks({
  entities,
}: {
  entities: readonly LinkedEntity[];
}) {
  if (!entities.length) return null;

  return (
    <Join divider=", ">
      {entities.map((entity) => (
        <TextLink href={getEntityUrl(entity)} key={entity.id} size="inherit">
          {entity.name}
        </TextLink>
      ))}
    </Join>
  );
}

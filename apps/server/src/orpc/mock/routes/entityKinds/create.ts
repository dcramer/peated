import type { EntityKindCreateInputSchema } from "@peated/server/orpc/contracts/entityKinds/create";
import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import type { EntityKind } from "@peated/server/types";
import type { z } from "zod";

export function createEntityKind(
  kind: EntityKind,
  input: z.infer<typeof EntityKindCreateInputSchema>,
) {
  return {
    ...mockEntity,
    ...input,
    id: mockEntity.id + 1000,
    kind,
    country: mockEntity.country,
    region: mockEntity.region,
  };
}

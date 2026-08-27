import { EntityInputSchema, EntitySchema } from "@peated/server/schemas";
import { contract } from "../base";

export const EntityKindCreateInputSchema = EntityInputSchema.omit({
  kind: true,
});

export function entityKindCreateContract({
  operationId,
  path,
  summary,
}: {
  operationId: string;
  path: `/${string}`;
  summary: string;
}) {
  return contract
    .route({ method: "POST", path, operationId, summary })
    .input(EntityKindCreateInputSchema)
    .output(EntitySchema);
}

import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/entities/resolve";

export default implement(contract).handler(async ({ input, errors }) => {
  const entity = await resolveEntity(input.entity);
  if (!entity?.kind) {
    throw errors.NOT_FOUND({ message: "Entity not found." });
  }

  return { id: entity.id, kind: entity.kind, name: entity.name };
});

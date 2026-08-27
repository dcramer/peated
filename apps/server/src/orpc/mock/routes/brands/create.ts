import { mockOS } from "@peated/server/orpc/mock/implementer";
import { createEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/create";

export default mockOS.brands.create.handler(async ({ input }) =>
  createEntityKind("brand", input),
);

import { mockOS } from "@peated/server/orpc/mock/implementer";
import { createEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/create";

export default mockOS.distilleries.create.handler(async ({ input }) =>
  createEntityKind("distillery", input),
);

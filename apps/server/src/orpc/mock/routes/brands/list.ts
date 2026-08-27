import { mockOS } from "@peated/server/orpc/mock/implementer";
import { listEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/list";

export default mockOS.brands.list.handler(async ({ input }) =>
  listEntityKind("brand", input),
);

import { mockOS } from "@peated/server/orpc/mock/implementer";
import { listEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/list";

export default mockOS.distilleries.list.handler(async ({ input }) =>
  listEntityKind("distillery", input),
);

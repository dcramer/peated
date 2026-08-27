import { mockOS } from "@peated/server/orpc/mock/implementer";
import { listEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/list";

export default mockOS.blenders.list.handler(async ({ input }) =>
  listEntityKind("blender", input),
);

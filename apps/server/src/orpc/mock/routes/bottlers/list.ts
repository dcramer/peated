import { mockOS } from "@peated/server/orpc/mock/implementer";
import { listEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/list";

export default mockOS.bottlers.list.handler(async ({ input }) =>
  listEntityKind("bottler", input),
);

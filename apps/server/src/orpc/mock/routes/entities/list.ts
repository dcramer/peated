import { mockOS } from "@peated/server/orpc/mock/implementer";
import { listEntities } from "@peated/server/orpc/mock/routes/entityKinds/list";

export default mockOS.entities.list.handler(async ({ input }) =>
  listEntities(input),
);

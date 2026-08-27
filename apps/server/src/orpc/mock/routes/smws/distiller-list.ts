import { mockEntities } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.smws.distillerList.handler(async () => ({
  results: mockEntities.filter((entity) => entity.kind === "distillery"),
  rel: { nextCursor: null, prevCursor: null },
}));

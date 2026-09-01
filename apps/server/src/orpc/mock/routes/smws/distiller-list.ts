import { SMWS_DISTILLERY_CODES } from "@peated/bottle-classifier/smws";
import { mockEntities } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.smws.distillerList.handler(async () => ({
  results: mockEntities
    .filter((entity) => entity.kind === "distillery")
    .map((entity) => ({
      ...entity,
      smwsCodes: Object.entries(SMWS_DISTILLERY_CODES)
        .filter(([, name]) =>
          [entity.name, entity.shortName].some(
            (entityName) => entityName?.toLowerCase() === name.toLowerCase(),
          ),
        )
        .map(([code]) => code),
    }))
    .filter((entity) => entity.smwsCodes.length),
  rel: { nextCursor: null, prevCursor: null },
}));

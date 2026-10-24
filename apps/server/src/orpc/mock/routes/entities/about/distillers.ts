import { mockEntities } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.about.distillers.handler(
  async ({ input, errors }) => {
    if (!mockEntities.some((entity) => entity.id === input.entity)) {
      throw errors.NOT_FOUND({ message: "Mock entity not found." });
    }
    return { results: [], withoutEntity: 0 };
  },
);

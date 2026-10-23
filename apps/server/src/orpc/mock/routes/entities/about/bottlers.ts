import {
  mockEntities,
  mockEntityBottlerCounts,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.about.bottlers.handler(
  async ({ input, errors }) => {
    if (!mockEntities.some((entity) => entity.id === input.entity)) {
      throw errors.NOT_FOUND({ message: "Mock entity not found." });
    }
    return (
      mockEntityBottlerCounts.get(input.entity) ?? {
        results: [],
        withoutEntity: 0,
      }
    );
  },
);

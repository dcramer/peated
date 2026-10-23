import {
  mockEntities,
  mockEntityAbouts,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.about.details.handler(
  async ({ input, errors }) => {
    if (!mockEntities.some((entity) => entity.id === input.entity)) {
      throw errors.NOT_FOUND({ message: "Mock entity not found." });
    }
    return mockEntityAbouts.get(input.entity) ?? null;
  },
);

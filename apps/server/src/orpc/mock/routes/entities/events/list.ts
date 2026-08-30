import {
  mockEntities,
  mockEntity,
  mockEntityHistory,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.events.list.handler(
  async ({ input, errors }) => {
    const entity = mockEntities.find(
      (candidate) => candidate.id === input.entity,
    );
    if (!entity) {
      throw errors.NOT_FOUND({ message: "Mock entity not found." });
    }

    return {
      results: entity.id === mockEntity.id ? mockEntityHistory : [],
    };
  },
);

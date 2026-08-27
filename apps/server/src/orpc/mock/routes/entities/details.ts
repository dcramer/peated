import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.details.handler(async ({ input, errors }) => {
  if (input.entity !== mockEntity.id) {
    throw errors.NOT_FOUND({ message: "Mock entity not found." });
  }

  return mockEntity;
});

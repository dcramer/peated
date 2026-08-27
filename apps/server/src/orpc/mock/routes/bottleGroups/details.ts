import { mockBottleGroup } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottleGroups.details.handler(
  async ({ input, errors }) => {
    if (input.group !== mockBottleGroup.id) {
      throw errors.NOT_FOUND({ message: "Mock Bottle Group not found." });
    }

    return mockBottleGroup;
  },
);

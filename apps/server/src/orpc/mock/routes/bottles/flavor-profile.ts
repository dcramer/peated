import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { mockBottleFlavorProfile } from "@peated/server/orpc/mock/fixtures/flavorProfile";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.flavorProfile.handler(
  async ({ input, errors }) => {
    if (!mockBottles.some((bottle) => bottle.id === input.bottle)) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }
    return mockBottleFlavorProfile;
  },
);

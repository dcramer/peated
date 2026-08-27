import { mockTasting, mockTastingFor } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastings.details.handler(
  async ({ input, context, errors }) => {
    if (input.tasting !== mockTasting.id) {
      throw errors.NOT_FOUND({ message: "Mock tasting not found." });
    }

    return mockTastingFor(context.user);
  },
);

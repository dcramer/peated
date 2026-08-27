import {
  mockTastingFor,
  mockTastings,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastings.details.handler(
  async ({ input, context, errors }) => {
    const tasting = mockTastings.find(
      (candidate) => candidate.id === input.tasting,
    );
    if (!tasting) {
      throw errors.NOT_FOUND({ message: "Mock tasting not found." });
    }

    return mockTastingFor(context.user, tasting);
  },
);

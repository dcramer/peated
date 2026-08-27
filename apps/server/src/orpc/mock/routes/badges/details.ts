import { mockBadges } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.badges.details.handler(async ({ input, errors }) => {
  const badge = mockBadges.find((candidate) => candidate.id === input.badge);
  if (!badge) {
    throw errors.NOT_FOUND({ message: "Mock badge not found." });
  }
  return badge;
});

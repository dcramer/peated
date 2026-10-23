import { hasEntityAboutPage } from "@peated/server/lib/entityAbout/display";
import {
  mockEntities,
  mockEntityAbouts,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.details.handler(async ({ input, errors }) => {
  const entity = mockEntities.find(
    (candidate) => candidate.id === input.entity,
  );
  if (!entity) {
    throw errors.NOT_FOUND({ message: "Mock entity not found." });
  }

  return {
    ...entity,
    images: [],
    isFollowing: false,
    hasAbout: hasEntityAboutPage(mockEntityAbouts.get(entity.id) ?? null),
  };
});

import { hasEntityAboutPage } from "@peated/server/lib/entityAbout/display";
import {
  mockEntities,
  mockEntityAbouts,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.about.sitemap.handler(async ({ input }) => {
  const results = mockEntities
    .filter(
      (entity) =>
        entity.id > input.afterId &&
        hasEntityAboutPage(mockEntityAbouts.get(entity.id) ?? null),
    )
    .sort((a, b) => a.id - b.id)
    .map(({ id, name, kind, updatedAt }) => ({ id, name, kind, updatedAt }));
  const page = results.slice(0, input.limit);
  return {
    results: page,
    nextAfterId: results.length > input.limit ? page.at(-1)!.id : null,
  };
});

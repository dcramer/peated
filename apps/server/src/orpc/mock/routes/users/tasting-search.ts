import {
  includesQuery,
  matchesMockUser,
  mockBottleFor,
  mockTastings,
  mockUser,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.tastingSearch.handler(
  async ({ input, context, errors }) => {
    if (!matchesMockUser(input.user, context.user)) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }
    if (!input.query) return { entities: [], bottles: [] };

    const tastedBottles = Array.from(
      new Map(
        mockTastings
          .filter((tasting) => tasting.createdBy.id === mockUser.id)
          .map(({ bottle }) => [bottle.id, bottle]),
      ).values(),
    );
    const counts = new Map<
      number,
      { entity: (typeof tastedBottles)[number]["brand"]; count: number }
    >();
    for (const bottle of tastedBottles) {
      const roleEntities = [bottle.brand, bottle.bottler, ...bottle.distillers];
      const unique = new Map(
        roleEntities.flatMap((entity) => (entity ? [[entity.id, entity]] : [])),
      );
      for (const entity of unique.values()) {
        const current = counts.get(entity.id);
        counts.set(entity.id, { entity, count: (current?.count ?? 0) + 1 });
      }
    }

    return {
      entities: Array.from(counts.values())
        .filter(({ entity }) =>
          includesQuery(input.query, entity.name, entity.shortName),
        )
        .sort((left, right) => right.count - left.count)
        .slice(0, input.limit),
      bottles: tastedBottles
        .filter((bottle) =>
          includesQuery(input.query, bottle.fullName, bottle.name),
        )
        .slice(0, input.limit)
        .map((bottle) => mockBottleFor(context.user, bottle)),
    };
  },
);

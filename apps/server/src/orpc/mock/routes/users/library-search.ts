import {
  includesQuery,
  matchesMockUser,
  mockBottleFor,
  mockCollectionBottles,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.librarySearch.handler(
  async ({ input, context, errors }) => {
    if (!matchesMockUser(input.user, context.user)) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }
    if (!input.query) return { entities: [], bottles: [] };

    const counts = new Map<
      number,
      {
        entity: (typeof mockCollectionBottles)[number]["bottle"]["brand"];
        count: number;
      }
    >();
    for (const { bottle } of mockCollectionBottles) {
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
      bottles: mockCollectionBottles
        .filter(({ bottle }) =>
          includesQuery(input.query, bottle.fullName, bottle.name),
        )
        .slice(0, input.limit)
        .map(({ bottle }) => mockBottleFor(context.user, bottle)),
    };
  },
);

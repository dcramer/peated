import {
  includesQuery,
  mockBottleFor,
  mockBottleGroup,
  mockBottles,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottleGroups.bottles.handler(
  async ({ input, context, errors }) => {
    if (input.group !== mockBottleGroup.id) {
      throw errors.NOT_FOUND({ message: "Mock Bottle Group not found." });
    }

    const bottles = mockBottles
      .filter(
        (bottle) =>
          bottle.group?.id === input.group &&
          includesQuery(input.query, bottle.fullName, bottle.name),
      )
      .toSorted((left, right) => {
        switch (input.sort) {
          case "name":
            return left.fullName.localeCompare(right.fullName);
          case "-name":
            return right.fullName.localeCompare(left.fullName);
          case "created":
            return left.createdAt.localeCompare(right.createdAt);
          case "-created":
            return right.createdAt.localeCompare(left.createdAt);
          case "age":
            return (left.statedAge ?? -1) - (right.statedAge ?? -1);
          case "-age":
            return (right.statedAge ?? -1) - (left.statedAge ?? -1);
          case "rating":
            return (left.avgRating ?? 3) - (right.avgRating ?? 3);
          case "-rating":
            return (right.avgRating ?? -1) - (left.avgRating ?? -1);
          case "tastings":
            return left.totalTastings - right.totalTastings;
          case "-tastings":
            return right.totalTastings - left.totalTastings;
          case "releaseYear":
            return (left.releaseYear ?? 0) - (right.releaseYear ?? 0);
          case "-releaseYear":
            return (right.releaseYear ?? -1) - (left.releaseYear ?? -1);
        }
      });

    return mockPage(
      bottles.map((bottle) => mockBottleFor(context.user, bottle)),
      input.cursor,
      input.limit,
    );
  },
);

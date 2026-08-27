import {
  BottleGroupNotFoundError,
  listBottleGroupBottles,
} from "@peated/server/lib/bottleGroupReads";
import { implement } from "@peated/server/orpc";
import bottleGroupBottlesContract from "@peated/server/orpc/contracts/bottleGroups/bottles";

export default implement(bottleGroupBottlesContract).handler(
  async ({ input: { group, ...input }, context, errors }) => {
    try {
      return await listBottleGroupBottles(
        group,
        input,
        context.user ?? undefined,
      );
    } catch (error) {
      if (error instanceof BottleGroupNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      throw error;
    }
  },
);

import {
  BottleGroupNotFoundError,
  loadBottleGroup,
} from "@peated/server/lib/bottleGroupReads";
import { implement } from "@peated/server/orpc";
import bottleGroupDetailsContract from "@peated/server/orpc/contracts/bottleGroups/details";

export default implement(bottleGroupDetailsContract).handler(
  async ({ input, errors }) => {
    try {
      return await loadBottleGroup(input.group);
    } catch (error) {
      if (error instanceof BottleGroupNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      throw error;
    }
  },
);

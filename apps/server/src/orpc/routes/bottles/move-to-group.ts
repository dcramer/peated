import {
  BottleGroupMoveError,
  moveBottleToGroup,
} from "@peated/server/lib/moveBottleToGroup";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/group",
    summary: "Move a bottle into a group",
    description:
      "Move a bottle into another BottleGroup, so the releases of one expression share a group. The bottle takes the group's shared name and keeps its own edition, age, years, ABV, and cask facts. The bottle's brand, bottler, series, category, and distillers must already match the group. A group left with no bottles is removed. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "moveBottleToGroup",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      group: z
        .number()
        .describe("ID of the BottleGroup to move the bottle into."),
    }),
  )
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await moveBottleToGroup({
        bottleId: input.bottle,
        groupId: input.group,
        context,
      });
      return await serialize(BottleSerializer, result.bottle, context.user);
    } catch (error) {
      if (!(error instanceof BottleGroupMoveError)) throw error;
      if (error.code === "forbidden") {
        throw errors.FORBIDDEN({ message: error.message, cause: error });
      }
      if (error.code === "not_found") {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error.code === "conflict") {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw errors.BAD_REQUEST({ message: error.message, cause: error });
    }
  });

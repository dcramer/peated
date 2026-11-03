import { strictAgentTool } from "@peated/agent-run";
import { z } from "zod";

import {
  BottleContextSchema,
  type BottleContext,
} from "../bottleContextContract";

const GetBottleContextArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
  })
  .strict();

const GetBottleContextResultSchema = z
  .object({
    context: BottleContextSchema.nullable(),
  })
  .strict();

const GET_BOTTLE_CONTEXT_DESCRIPTION =
  "Load bounded read-only identity context for one existing Peated Bottle, including shared and exact state, accepted references, siblings, observations, related Entity ids, and normalized public-image label evidence. Use before proposing an operation that targets or compares this Bottle.";

export function createGetBottleContextTool({
  getBottleContext,
  onContext,
}: {
  getBottleContext: (bottleId: number) => Promise<BottleContext | null>;
  onContext?: (context: BottleContext) => void;
}) {
  return strictAgentTool({
    name: "get_bottle_context",
    description: GET_BOTTLE_CONTEXT_DESCRIPTION,
    parameters: GetBottleContextArgsSchema,
    execute: async ({ bottleId }) => {
      const context = BottleContextSchema.nullable().parse(
        await getBottleContext(bottleId),
      );
      if (context) {
        onContext?.(context);
      }
      return GetBottleContextResultSchema.parse({ context });
    },
  });
}

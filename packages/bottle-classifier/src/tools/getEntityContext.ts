import { tool } from "@openai/agents";
import { z } from "zod";

import {
  EntityContextSchema,
  type EntityContext,
} from "../bottleContextContract";
import { startToolSpan } from "../observability";

const GetEntityContextArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
  })
  .strict();

const GetEntityContextResultSchema = z
  .object({
    context: EntityContextSchema.nullable(),
  })
  .strict();

const GET_ENTITY_CONTEXT_DESCRIPTION =
  "Load bounded read-only identity context for one existing Peated Brand, distiller, or bottler Entity, including aliases, roles, public metadata, and related Bottle samples. Use before proposing an operation that targets or compares this Entity.";

export function createGetEntityContextTool({
  getEntityContext,
  onContext,
}: {
  getEntityContext: (entityId: number) => Promise<EntityContext | null>;
  onContext?: (context: EntityContext) => void;
}) {
  return tool({
    name: "get_entity_context",
    description: GET_ENTITY_CONTEXT_DESCRIPTION,
    parameters: GetEntityContextArgsSchema,
    execute: async ({ entityId }) =>
      await startToolSpan({
        name: "get_entity_context",
        description: GET_ENTITY_CONTEXT_DESCRIPTION,
        args: { entityId },
        callback: async () => {
          const context = EntityContextSchema.nullable().parse(
            await getEntityContext(entityId),
          );
          if (context) {
            onContext?.(context);
          }
          return GetEntityContextResultSchema.parse({ context });
        },
      }),
  });
}

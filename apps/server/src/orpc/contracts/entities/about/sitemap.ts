import { EntityKindEnum } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entity-about/sitemap",
    summary: "List About pages for the sitemap",
    description:
      "List entities with a published About page, by entity ID. Continue with `nextAfterId` until it is null.",
    operationId: "listEntityAboutPages",
  })
  .input(
    z.object({
      afterId: z.coerce.number().int().nonnegative().default(0),
      limit: z.coerce.number().int().min(1).max(500).default(500),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          kind: EntityKindEnum,
          updatedAt: z.string().datetime(),
        }),
      ),
      nextAfterId: z.number().nullable(),
    }),
  );

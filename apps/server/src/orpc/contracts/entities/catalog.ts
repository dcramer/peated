import { CategoryEnum, EntityKindEnum } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const RelatedEntitySchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullable(),
  kind: EntityKindEnum,
  count: z.number(),
});

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/catalog",
    summary: "Get an entity catalog summary",
    description: "Summarize bottles and related producers for an entity",
    spec: (spec) => ({ ...spec, operationId: "getEntityCatalog" }),
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(
    z.object({
      totalBottles: z.number(),
      relationships: z.object({
        brand: z.number(),
        bottler: z.number(),
        distiller: z.number(),
      }),
      distilleryCoverage: z.object({
        documented: z.number(),
        total: z.number(),
      }),
      categories: z.array(
        z.object({
          category: CategoryEnum.nullable(),
          count: z.number(),
        }),
      ),
      related: z.object({
        brands: z.array(RelatedEntitySchema),
        bottlers: z.array(RelatedEntitySchema),
        distillers: z.array(RelatedEntitySchema),
      }),
      notableBottles: z.array(
        z.object({
          id: z.number(),
          fullName: z.string(),
          totalTastings: z.number(),
          avgRating: z.number().nullable(),
        }),
      ),
    }),
  );

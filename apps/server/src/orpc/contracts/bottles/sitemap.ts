import { z } from "zod";
import { contract } from "../base";

export const BottleSitemapEntrySchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export default contract
  .route({
    method: "GET",
    path: "/bottles/sitemap",
    summary: "List bottles for a sitemap",
    description: "List the public Bottle fields used to build a sitemap page",
    operationId: "listBottleSitemapEntries",
    spec: (spec) => ({
      ...spec,
      "x-internal": true,
      "x-badges": [{ name: "Internal", position: "before" }],
    }),
  })
  .input(
    z.object({
      page: z.coerce.number().int().positive(),
    }),
  )
  .output(z.object({ results: z.array(BottleSitemapEntrySchema) }));

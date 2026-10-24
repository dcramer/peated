import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/regions",
    summary: "List user regions",
    description:
      "Count a user's tastings by country and region. `results` holds the 25 largest country and region groups; `countries` totals every country.",
    operationId: "listUserRegions",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          country: z.object({ name: z.string(), slug: z.string() }),
          region: z.object({ name: z.string(), slug: z.string() }).nullable(),
          count: z.number(),
        }),
      ),
      countries: z.array(
        z.object({
          country: z.object({ name: z.string(), slug: z.string() }),
          count: z.number(),
        }),
      ),
      totalCount: z.number(),
    }),
  );

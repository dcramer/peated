import { CategoryEnum } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/countries/{country}/regions/{region}/categories",
    summary: "Get region categories",
    description:
      "Retrieve whisky categories and their counts for a region based on distillery locations",
    operationId: "listRegionCategories",
  })
  .input(
    z.object({
      country: z.coerce.string(),
      region: z.coerce.string(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          count: z.number(),
          category: CategoryEnum.nullable(),
        }),
      ),
      totalCount: z.number(),
    }),
  );

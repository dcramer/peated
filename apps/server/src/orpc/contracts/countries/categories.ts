import { CategoryEnum } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/countries/categories",
    summary: "Get country categories",
    description:
      "Retrieve whisky categories and their counts for a specific country based on distillery locations",
    operationId: "listCountryCategories",
  })
  .input(
    z.object({
      country: z.union([z.string(), z.coerce.number()]),
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

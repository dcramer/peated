import { z } from "zod";
import { contract } from "./base";

export default contract
  .route({
    method: "GET",
    path: "/stats",
    summary: "Get total counts",
    description: "Get total counts for tastings, Bottles, and entities",
    operationId: "getStats",
  })
  .output(
    z.object({
      totalTastings: z.number(),
      totalBottles: z.number(),
      totalEntities: z.number(),
      totalBrands: z.number(),
      totalDistilleries: z.number(),
      totalBottlers: z.number(),
      totalBlenders: z.number(),
      totalCompanies: z.number(),
    }),
  );

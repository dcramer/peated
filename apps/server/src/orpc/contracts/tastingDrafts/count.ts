import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/tasting-drafts/count",
    summary: "Count tasting drafts",
    description: "Count your own tasting drafts.",
    operationId: "countTastingDrafts",
  })
  .output(z.object({ count: z.number().int() }));

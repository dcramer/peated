import {
  BadgeAwardSchema,
  TastingInputSchema,
  TastingSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "POST",
    path: "/tastings",
    summary: "Create tasting",
    description:
      "Create a new tasting entry for a bottle with notes, an optional rating band, and tasting details.",
    operationId: "createTasting",
  })
  .input(TastingInputSchema)
  .output(
    z.object({
      tasting: TastingSchema,
      awards: z.array(BadgeAwardSchema),
    }),
  );

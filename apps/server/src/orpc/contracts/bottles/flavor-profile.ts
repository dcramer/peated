import { BottleFlavorProfileSchema } from "@peated/server/schemas/flavorProfile";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/flavor-profile",
    summary: "Get a bottle flavor profile",
    description:
      "Count how many public reviews and tastings of one active bottle mention each tasting-note category. Each review or tasting counts once per category. Private entries and suggested notes are excluded.",
    spec: (spec) => ({ ...spec, operationId: "getBottleFlavorProfile" }),
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(BottleFlavorProfileSchema);

import { BottleFlavorProfileSchema } from "@peated/server/schemas/flavorProfile";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/flavor-profile",
    summary: "Get a bottle flavor profile",
    description:
      "Count public tastings of one active Bottle with each tasting-note family. Each tasting counts once per family. Only tastings with recognized notes enter the denominator; private and suggested notes are excluded.",
    spec: (spec) => ({ ...spec, operationId: "getBottleFlavorProfile" }),
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(BottleFlavorProfileSchema);

import { FlavorProfileSchema } from "@peated/server/schemas/flavorProfile";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/flavor-profile",
    summary: "Get a distillery flavor profile",
    description:
      "Count active bottles made at a distillery with each family of public tasting notes. Each bottle counts once per family. Coverage includes only bottles with recognized tasting tags.",
    operationId: "getEntityFlavorProfile",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(FlavorProfileSchema);

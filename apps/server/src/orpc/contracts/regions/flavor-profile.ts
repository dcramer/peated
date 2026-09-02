import { FlavorProfileSchema } from "@peated/server/schemas/flavorProfile";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/countries/{country}/regions/{region}/flavor-profile",
    summary: "Get a region flavor profile",
    description:
      "Count active bottles produced in a region with each family of public tasting notes. Origin follows the distillery location. Each bottle counts once per family. Coverage includes only bottles with recognized tasting tags.",
    operationId: "getRegionFlavorProfile",
  })
  .input(z.object({ country: z.string(), region: z.string() }))
  .output(FlavorProfileSchema);

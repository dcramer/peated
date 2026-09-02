import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { getBottleFlavorProfile } from "@peated/server/lib/bottleFlavorProfile";
import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import flavorProfileContract from "@peated/server/orpc/contracts/entities/flavor-profile";
import { sql } from "drizzle-orm";

export default implement(flavorProfileContract).handler(
  async ({ input, errors }) => {
    const entity = await resolveEntity(input.entity);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });
    if (entity.kind !== "distillery") {
      throw errors.BAD_REQUEST({
        message: "Choose a distillery for this flavor profile.",
      });
    }
    return getBottleFlavorProfile(sql`EXISTS (
    SELECT FROM ${bottlesToDistillers}
    WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
      AND ${bottlesToDistillers.distillerId} = ${entity.id}
  )`);
  },
);

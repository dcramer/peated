import { countReleaseYears } from "@peated/server/lib/entityAbout/catalogNumbers";
import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import entityAboutReleaseYearsContract from "@peated/server/orpc/contracts/entities/about/release-years";

export default implement(entityAboutReleaseYearsContract).handler(
  async function ({ input, errors }) {
    const entity = await resolveEntity(input.entity);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    return await countReleaseYears(entity.id);
  },
);

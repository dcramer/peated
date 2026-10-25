import { countDistillers } from "@peated/server/lib/entityAbout/catalogNumbers";
import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import entityAboutDistillersContract from "@peated/server/orpc/contracts/entities/about/distillers";

export default implement(entityAboutDistillersContract).handler(
  async function ({ input, errors }) {
    const entity = await resolveEntity(input.entity);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

    return await countDistillers(entity);
  },
);

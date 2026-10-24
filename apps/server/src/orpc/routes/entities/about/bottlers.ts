import { countBottlers } from "@peated/server/lib/entityAbout/catalogNumbers";
import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import entityAboutBottlersContract from "@peated/server/orpc/contracts/entities/about/bottlers";

export default implement(entityAboutBottlersContract).handler(async function ({
  input,
  errors,
}) {
  const entity = await resolveEntity(input.entity);
  if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

  return await countBottlers(entity.id);
});

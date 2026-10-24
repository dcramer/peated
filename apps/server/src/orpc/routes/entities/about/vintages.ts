import { countVintages } from "@peated/server/lib/entityAbout/catalogNumbers";
import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import entityAboutVintagesContract from "@peated/server/orpc/contracts/entities/about/vintages";

export default implement(entityAboutVintagesContract).handler(async function ({
  input,
  errors,
}) {
  const entity = await resolveEntity(input.entity);
  if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

  return await countVintages(entity.id);
});

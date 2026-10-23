import { db } from "@peated/server/db";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { resolveEntity } from "@peated/server/lib/resolveEntity";
import { implement } from "@peated/server/orpc";
import entityAboutDetailsContract from "@peated/server/orpc/contracts/entities/about/details";
import { serialize } from "@peated/server/serializers";
import { EntityAboutSerializer } from "@peated/server/serializers/entityAbout";

export default implement(entityAboutDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const entity = await resolveEntity(input.entity);
  if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

  const about = await getEntityAbout(db, entity.id);
  if (!about || about.status === "hidden") return null;

  return await serialize(
    EntityAboutSerializer,
    { ...about, id: about.entityId },
    context.user,
  );
});

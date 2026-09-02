import { mockEntities } from "@peated/server/orpc/mock/fixtures/entities";
import { mockFlavorProfile } from "@peated/server/orpc/mock/fixtures/flavorProfile";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.flavorProfile.handler(
  async ({ input, errors }) => {
    const entity = mockEntities.find((item) => item.id === input.entity);
    if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });
    if (entity.kind !== "distillery")
      throw errors.BAD_REQUEST({
        message: "Choose a distillery for this flavor profile.",
      });
    return mockFlavorProfile;
  },
);

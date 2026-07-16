import { getUserActor } from "@peated/server/lib/actors";
import { loadCatalogTarget } from "@peated/server/lib/catalogTargets";
import { IndependentConcreteBottleCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
} from "@peated/server/lib/createBottle";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import { procedure } from "@peated/server/orpc";
import {
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware/auth";
import { ExactCatalogTargetV1Schema } from "@peated/server/schemas";

export default procedure
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottles",
    summary: "Create bottle",
    description:
      "Create a new bottle entry with brand, distillery, and whisky details",
    spec: (spec) => ({
      ...spec,
      operationId: "createBottle",
    }),
  })
  .input(IndependentConcreteBottleCreateRouteInputSchema)
  .output(ExactCatalogTargetV1Schema)
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await createConcreteBottle({
        context,
        input: {
          kind: "independent",
          stable: {
            name: input.name,
            statedAge: input.statedAge,
            series: input.series,
            category: input.category,
            brand: input.brand,
            distillers: input.distillers,
            bottler: input.bottler,
            flavorProfile: input.flavorProfile,
          },
          exact: {
            edition: input.edition,
            statedAge: null,
            abv: input.abv,
            singleCask: input.singleCask,
            caskStrength: input.caskStrength,
            vintageYear: input.vintageYear,
            releaseYear: input.releaseYear,
            caskSize: input.caskSize,
            caskType: input.caskType,
            caskFill: input.caskFill,
            description: input.description,
            descriptionSrc: input.descriptionSrc,
            tastingNotes: input.tastingNotes,
          },
        },
      });
      const target = await loadCatalogTarget(result.exactTarget.id, {
        actor: await getUserActor(context.user),
        permissions: { canReadCatalogIdentity: true },
      });

      if (
        target.kind !== "bottle" ||
        target.targetId !== result.exactTarget.id ||
        target.bottle.id !== result.bottle.id ||
        target.group.id !== result.group.id
      ) {
        throw new Error(
          "Created Bottle target does not match its catalog graph.",
        );
      }

      return target;
    } catch (err) {
      if (err instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: err.message,
          data: {
            bottle: err.bottleId,
          },
        });
      }

      if (err instanceof BottleCreateBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });

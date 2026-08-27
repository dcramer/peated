import {
  createExternalReview,
  ExternalReviewBottleStateError,
  type ExternalReviewServices,
} from "@peated/server/lib/createExternalReview";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalReviewInputSchema,
  ExternalReviewSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalReviewSerializer } from "@peated/server/serializers/externalReview";

export type ExternalReviewClassifier = NonNullable<
  ExternalReviewServices["classifyReference"]
>;

export function createExternalReviewProcedure(
  classifyReference?: ExternalReviewClassifier,
) {
  return procedure
    .use(requireAdmin)
    .route({
      method: "POST",
      path: "/external-reviews",
      summary: "Create external review",
      description:
        "Create an external review with automatic Bottle matching and alias creation. Requires admin privileges",
      operationId: "createExternalReview",
    })
    .input(ExternalReviewInputSchema)
    .output(ExternalReviewSchema)
    .handler(async function ({ input, context, errors }) {
      try {
        const externalReview = await createExternalReview(
          input,
          {
            initiatedByUserId: context.user.id,
          },
          { classifyReference },
        );
        return await serialize(
          ExternalReviewSerializer,
          externalReview,
          context.user,
        );
      } catch (error) {
        if (error instanceof ExternalSiteNotFoundError) {
          throw errors.NOT_FOUND({ message: "Site not found.", cause: error });
        }
        if (error instanceof ExternalReviewBottleStateError) {
          if (error.reason === "missing") {
            throw errors.NOT_FOUND({
              message: error.message,
              cause: error.cause,
            });
          }
          throw errors.CONFLICT({ message: error.message, cause: error.cause });
        }
        throw error;
      }
    });
}

export default createExternalReviewProcedure();

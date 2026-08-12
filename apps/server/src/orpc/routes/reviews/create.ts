import {
  createExternalReview,
  ExternalReviewBottleStateError,
  ExternalReviewInputSchema,
} from "@peated/server/lib/createExternalReview";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/reviews",
    summary: "Create review",
    description:
      "Create a new review from external site data with automatic bottle matching and alias creation. Requires admin privileges",
    operationId: "createReview",
  })
  .input(ExternalReviewInputSchema)
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const review = await createExternalReview(input, {
        initiatedByUserId: context.user.id,
      });
      return await serialize(ReviewSerializer, review, context.user);
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

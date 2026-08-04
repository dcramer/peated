import { getBottleCheckForReview } from "@peated/server/lib/bottleChecks";
import { prepareBottleCheckReviewOperations } from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { AuditDetailsResponseSchema } from "@peated/server/schemas/bottleChecks";
import {
  serializeBottleCheck,
  serializeReviewOperation,
} from "@peated/server/serializers/bottleCheck";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/audits/{audit}",
    summary: "Get an audit",
    spec: (spec) => ({ ...spec, operationId: "getAudit" }),
  })
  .input(z.object({ audit: z.coerce.number().int().positive() }).strict())
  .output(AuditDetailsResponseSchema)
  .handler(async ({ input, errors }) => {
    const check = await getBottleCheckForReview(input.audit);
    if (!check) {
      throw errors.NOT_FOUND({ message: "Audit not found." });
    }
    const reviewOperations = await prepareBottleCheckReviewOperations(check);
    return {
      audit: serializeBottleCheck(check),
      reviewOperations: reviewOperations.map((operation) => ({
        ...operation,
        review: serializeReviewOperation(operation.review),
      })),
    };
  });

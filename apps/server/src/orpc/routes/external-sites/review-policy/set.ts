import { isExternalReviewSiteType } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSites,
} from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalReviewSourcePolicyInputSchema,
  ExternalReviewSourcePolicySchema,
  ExternalSiteTypeEnum,
} from "@peated/server/schemas";
import { serializeExternalReviewSourcePolicy } from "@peated/server/serializers/externalSite";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    site: ExternalSiteTypeEnum,
    policy: ExternalReviewSourcePolicyInputSchema,
  })
  .strict();

function auditFields(
  policy: z.infer<typeof ExternalReviewSourcePolicySchema> | null,
) {
  return policy
    ? {
        publicationMode: policy.publicationMode,
        allowFetching: policy.allowFetching,
        allowLlmProcessing: policy.allowLlmProcessing,
        allowScoreDisplay: policy.allowScoreDisplay,
        allowSummaryDisplay: policy.allowSummaryDisplay,
      }
    : null;
}

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/admin/external-sites/{site}/review-policy",
    summary: "Update external review source policy",
    operationId: "updateExternalReviewSourcePolicy",
  })
  .input(InputSchema)
  .output(ExternalReviewSourcePolicySchema)
  .handler(async ({ input, context, errors }) => {
    if (!isExternalReviewSiteType(input.site)) {
      throw errors.NOT_FOUND({ message: "Review source not found." });
    }

    const { policy: inputPolicy } = input;

    const { previous, policy, site } = await db.transaction(async (tx) => {
      const [site] = await tx
        .select()
        .from(externalSites)
        .where(eq(externalSites.type, input.site))
        .limit(1)
        .for("update");
      if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

      const [previousPolicy] = await tx
        .select()
        .from(externalReviewSourcePolicies)
        .where(eq(externalReviewSourcePolicies.externalSiteId, site.id))
        .limit(1)
        .for("update");
      const previous = serializeExternalReviewSourcePolicy(
        site.id,
        previousPolicy ?? null,
      );
      const values =
        inputPolicy.publicationMode === "disabled"
          ? {
              externalSiteId: site.id,
              publicationMode: "disabled" as const,
              allowFetching: false,
              allowLlmProcessing: false,
              allowScoreDisplay: false,
              allowSummaryDisplay: false,
            }
          : {
              externalSiteId: site.id,
              ...inputPolicy,
            };

      const [policy] = await tx
        .insert(externalReviewSourcePolicies)
        .values(values)
        .onConflictDoUpdate({
          target: externalReviewSourcePolicies.externalSiteId,
          set: {
            ...values,
            updatedAt: sql`NOW()`,
          },
        })
        .returning();
      if (!policy) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to update review source policy.",
        });
      }

      return { previous, policy, site };
    });

    const serialized = serializeExternalReviewSourcePolicy(site.id, policy);
    auditLog({
      event: AuditEvent.EXTERNAL_REVIEW_SOURCE_POLICY_UPDATED,
      userId: context.user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: {
        site: site.type,
        previous: auditFields(previous),
        next: auditFields(serialized),
      },
    });

    return serialized;
  });

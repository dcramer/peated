import { db } from "@peated/server/db";
import { externalReviewSourcePolicies } from "@peated/server/db/schema";

describe("external review source policy", () => {
  test("is disabled with no capabilities by default", async ({ fixtures }) => {
    const policy = await fixtures.ExternalReviewSourcePolicy();

    expect(policy).toMatchObject({
      publicationMode: "disabled",
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });
  });

  test("review-only fixture enables configured capabilities", async ({
    fixtures,
  }) => {
    const policy = await fixtures.EnabledExternalReviewSourcePolicy();

    expect(policy).toMatchObject({
      publicationMode: "review_only",
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
    });
  });

  test("disabled policies cannot retain capabilities", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    await expect(
      db.insert(externalReviewSourcePolicies).values({
        externalSiteId: site.id,
        allowLlmProcessing: true,
      }),
    ).rejects.toThrow(/external_review_source_policy_disabled_check/);
  });

  test("summary display requires LLM processing", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    await expect(
      db.insert(externalReviewSourcePolicies).values({
        externalSiteId: site.id,
        publicationMode: "review_only",
        allowSummaryDisplay: true,
      }),
    ).rejects.toThrow(/external_review_source_policy_summary_check/);
  });

  test("review-only policies do not require evidence", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    const [policy] = await db
      .insert(externalReviewSourcePolicies)
      .values({
        externalSiteId: site.id,
        publicationMode: "review_only",
      })
      .returning();

    expect(policy).toMatchObject({
      publicationMode: "review_only",
    });
  });
});

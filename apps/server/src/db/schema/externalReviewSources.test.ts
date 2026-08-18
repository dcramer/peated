import { db } from "@peated/server/db";
import { externalReviewSourcePolicies } from "@peated/server/db/schema";
import { getUserActorByIdForDatabase } from "@peated/server/lib/actors";

describe("external review source policy", () => {
  test("is disabled with no capabilities by default", async ({ fixtures }) => {
    const policy = await fixtures.ExternalReviewSourcePolicy();

    expect(policy).toMatchObject({
      publicationMode: "disabled",
      allowFetching: false,
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
      policyEvidenceUrl: null,
      approvalReference: null,
      reviewedAt: null,
      approvedByActorId: null,
    });
  });

  test("approved fixture records capabilities and approval evidence", async ({
    fixtures,
  }) => {
    const policy = await fixtures.ApprovedExternalReviewSourcePolicy();

    expect(policy).toMatchObject({
      publicationMode: "review_only",
      allowFetching: true,
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
    });
    expect(policy.policyEvidenceUrl).not.toBeNull();
    expect(policy.approvalReference).not.toBeNull();
    expect(policy.reviewedAt).not.toBeNull();
    expect(policy.approvedByActorId).not.toBeNull();
  });

  test("disabled policies cannot retain capabilities", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    await expect(
      db.insert(externalReviewSourcePolicies).values({
        externalSiteId: site.id,
        allowFetching: true,
      }),
    ).rejects.toThrow(/external_review_source_policy_disabled_check/);
  });

  test("summary display requires LLM processing", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActorByIdForDatabase(db, user.id);

    await expect(
      db.insert(externalReviewSourcePolicies).values({
        externalSiteId: site.id,
        publicationMode: "review_only",
        allowFetching: true,
        allowSummaryDisplay: true,
        policyEvidenceUrl: "https://example.com/permission",
        approvalReference: "agreement-1",
        reviewedAt: new Date(),
        approvedByActorId: actor.id,
      }),
    ).rejects.toThrow(/external_review_source_policy_summary_check/);
  });

  test("enabled policies require approval evidence", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();

    await expect(
      db.insert(externalReviewSourcePolicies).values({
        externalSiteId: site.id,
        publicationMode: "review_only",
        allowFetching: true,
      }),
    ).rejects.toThrow(/external_review_source_policy_approval_check/);
  });
});

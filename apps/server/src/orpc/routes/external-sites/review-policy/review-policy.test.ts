import { db } from "@peated/server/db";
import { externalReviewSourcePolicies } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

vi.mock("@peated/server/lib/auditLog", () => ({
  AuditEvent: {
    LOGIN_SUCCESS: "auth.login.success",
    LOGIN_FAILED: "auth.login.failed",
    LOGOUT: "auth.logout",
    PASSKEY_REGISTERED: "passkey.registered",
    PASSKEY_UPDATED: "passkey.updated",
    PASSKEY_AUTH_SUCCESS: "passkey.auth.success",
    PASSKEY_AUTH_FAILED: "passkey.auth.failed",
    PASSKEY_DELETED: "passkey.deleted",
    RECOVERY_REQUESTED: "recovery.requested",
    RECOVERY_SUCCESS: "recovery.success",
    RECOVERY_FAILED: "recovery.failed",
    RATE_LIMIT_EXCEEDED: "security.rate_limit",
    INVALID_CHALLENGE: "security.invalid_challenge",
    REPLAY_ATTACK_DETECTED: "security.replay_attack",
    EXTERNAL_REVIEW_SOURCE_POLICY_UPDATED:
      "external_review.source_policy.updated",
  },
  auditLog: vi.fn(),
}));

const reviewOnlyPolicy = {
  publicationMode: "review_only" as const,
  allowFetching: true as const,
  allowLlmProcessing: true,
  allowScoreDisplay: true,
  allowSummaryDisplay: true,
};

describe("external review source policy routes", () => {
  test("requires a moderator", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const user = await fixtures.User();

    const getError = await waitError(() =>
      routerClient.externalSites.reviewPolicy.get(
        { site: site.type },
        { context: { user } },
      ),
    );
    const setError = await waitError(() =>
      routerClient.externalSites.reviewPolicy.set(
        { site: site.type, policy: reviewOnlyPolicy },
        { context: { user } },
      ),
    );

    expect(getError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(setError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns disabled defaults before a policy is enabled", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.get(
      { site: site.type },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      externalSiteId: site.id,
      publicationMode: "disabled",
      allowFetching: false,
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });
  });

  test("enables capabilities and records an audit event", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.set(
      { site: site.type, policy: reviewOnlyPolicy },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      externalSiteId: site.id,
      ...reviewOnlyPolicy,
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditEvent.EXTERNAL_REVIEW_SOURCE_POLICY_UPDATED,
        userId: moderator.id,
        metadata: {
          site: site.type,
          previous: {
            publicationMode: "disabled",
            allowFetching: false,
            allowLlmProcessing: false,
            allowScoreDisplay: false,
            allowSummaryDisplay: false,
          },
          next: {
            publicationMode: "review_only",
            allowFetching: true,
            allowLlmProcessing: true,
            allowScoreDisplay: true,
            allowSummaryDisplay: true,
          },
        },
      }),
    );
  });

  test("disabling a source clears its capabilities", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.set(
      {
        site: site.type,
        policy: { publicationMode: "disabled" },
      },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      publicationMode: "disabled",
      allowFetching: false,
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });

    const persisted = await db.query.externalReviewSourcePolicies.findFirst({
      where: eq(externalReviewSourcePolicies.externalSiteId, site.id),
    });
    expect(persisted).toMatchObject({
      publicationMode: "disabled",
      allowFetching: false,
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });
  });

  test("rejects summary display without the LLM processing capability", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.reviewPolicy.set(
        {
          site: site.type,
          policy: {
            ...reviewOnlyPolicy,
            allowLlmProcessing: false,
          },
        },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("does not expose policy controls for retailer sources", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.reviewPolicy.get(
        { site: site.type },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Review source not found.]`);
  });

  test("keeps automatic publication unavailable during the pilot", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.reviewPolicy.set(
        {
          site: site.type,
          policy: {
            ...reviewOnlyPolicy,
            // @ts-expect-error Proves the runtime boundary rejects a future mode.
            publicationMode: "automatic",
          },
        },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});

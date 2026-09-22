import { db } from "@peated/server/db";
import { reports } from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
});

describe("POST /reports", () => {
  test("requires auth", async () => {
    const err = await waitError(() =>
      routerClient.reports.create({
        objectType: "tasting",
        objectId: 1,
        reason: "spam",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a tasting and records the tasting's author", async ({
    defaults,
    fixtures,
  }) => {
    const author = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: author.id });

    const report = await routerClient.reports.create(
      {
        objectType: "tasting",
        objectId: tasting.id,
        reason: "harassment",
        comment: "This is targeted at me.",
      },
      { context: { user: defaults.user } },
    );

    expect(report).toMatchObject({
      objectType: "tasting",
      objectId: tasting.id,
      reason: "harassment",
      comment: "This is targeted at me.",
      status: "open",
    });
    const [saved] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, report.id));
    expect(saved.reportedUserId).toBe(author.id);
    expect(saved.createdById).toBe(defaults.user.id);
    expect(workerClient.pushJob).toHaveBeenCalledWith("NotifyReport", {
      reportId: report.id,
    });
  });

  test("requires details for Something else and numeric IDs outside flights", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const noDetails = await waitError(() =>
      routerClient.reports.create(
        { objectType: "tasting", objectId: tasting.id, reason: "other" },
        { context: { user: defaults.user } },
      ),
    );
    expect(noDetails).toMatchInlineSnapshot(`[Error: Input validation failed]`);

    const badId = await waitError(() =>
      routerClient.reports.create(
        { objectType: "tasting", objectId: "abc", reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(badId).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("reports a comment, a member review, and a member", async ({
    defaults,
    fixtures,
  }) => {
    const author = await fixtures.User();
    const comment = await fixtures.Comment({ createdById: author.id });
    const bottle = await fixtures.Bottle();
    const review = await routerClient.memberReviews.save(
      { bottle: bottle.id, notes: "Rude words.", score: 10 },
      { context: { user: author } },
    );

    for (const target of [
      { objectType: "comment" as const, objectId: comment.id },
      { objectType: "member_review" as const, objectId: review.id },
      { objectType: "user" as const, objectId: author.id },
    ]) {
      const report = await routerClient.reports.create(
        { ...target, reason: "other", comment: "Rude words." },
        { context: { user: defaults.user } },
      );
      const [saved] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, report.id));
      expect(saved.reportedUserId).toBe(author.id);
    }
  });

  test("reports a bottle, an entity, a series, and a flight by their creator", async ({
    defaults,
    fixtures,
  }) => {
    const author = await fixtures.User();
    const actor = await getUserActor(author);
    const bottle = await fixtures.Bottle({ createdByActorId: actor.id });
    const entity = await fixtures.Entity({ createdByActorId: actor.id });
    const series = await fixtures.BottleSeries({ createdByActorId: actor.id });
    const flight = await fixtures.Flight({ createdById: author.id });

    for (const target of [
      { objectType: "bottle" as const, objectId: bottle.id },
      { objectType: "entity" as const, objectId: entity.id },
      { objectType: "bottle_series" as const, objectId: series.id },
      { objectType: "flight" as const, objectId: flight.publicId },
    ]) {
      const report = await routerClient.reports.create(
        { ...target, reason: "inaccurate" },
        { context: { user: defaults.user } },
      );
      const [saved] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, report.id));
      expect(saved.objectType).toBe(target.objectType);
      expect(saved.reportedUserId).toBe(author.id);
    }
    const [flightReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.objectType, "flight"));
    expect(flightReport.objectId).toBe(flight.id);
  });

  test("names no member for a record the system created", async ({
    defaults,
    fixtures,
  }) => {
    const systemActor = await getPeatedSystemActor();
    const bottle = await fixtures.Bottle({ createdByActorId: systemActor.id });

    const report = await routerClient.reports.create(
      { objectType: "bottle", objectId: bottle.id, reason: "spam" },
      { context: { user: defaults.user } },
    );

    const [saved] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, report.id));
    expect(saved.reportedUserId).toBeNull();
  });

  test("rejects reporting your own bottle and unknown flights", async ({
    defaults,
    fixtures,
  }) => {
    const actor = await getUserActor(defaults.user);
    const bottle = await fixtures.Bottle({ createdByActorId: actor.id });
    const own = await waitError(() =>
      routerClient.reports.create(
        { objectType: "bottle", objectId: bottle.id, reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(own).toMatchInlineSnapshot(
      `[Error: You cannot report your own content.]`,
    );

    const missing = await waitError(() =>
      routerClient.reports.create(
        { objectType: "flight", objectId: "not-a-flight", reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(missing).toMatchInlineSnapshot(`[Error: Content not found.]`);
  });

  test("returns the existing open report instead of a duplicate", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const first = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "spam" },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "hate" },
      { context: { user: defaults.user } },
    );

    expect(second.id).toBe(first.id);
    expect(second.reason).toBe("spam");
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.createdById, defaults.user.id));
    expect(rows).toHaveLength(1);
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
  });

  test("rejects reporting your own content", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({ createdById: defaults.user.id });
    const err = await waitError(() =>
      routerClient.reports.create(
        { objectType: "tasting", objectId: tasting.id, reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You cannot report your own content.]`,
    );
  });

  test("rejects missing or removed content", async ({ defaults, fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const tasting = await fixtures.Tasting();
    await routerClient.admin.content.moderate(
      { kind: "tasting", id: tasting.id, removed: true, reason: "Spam." },
      { context: { user: admin } },
    );

    const err = await waitError(() =>
      routerClient.reports.create(
        { objectType: "tasting", objectId: tasting.id, reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Content not found.]`);
  });
});

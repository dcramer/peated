import { db } from "@peated/server/db";
import {
  bottles,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { CatalogTargetInvalidMappingError } from "@peated/server/lib/catalogTargets";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import onBottleAliasChange from "./onBottleAliasChange";

vi.mock("@peated/server/worker/client", () => ({
  runJob: vi.fn(),
}));

describe("onBottleAliasChange", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("syncs only targetless consumers for a raw legacy release alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 4",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: release.fullName,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: release.fullName,
    });
    const independentlyMatchedBottle = await fixtures.Bottle();
    const independentlyMatchedTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { eq }) =>
        eq(targets.bottleId, independentlyMatchedBottle.id),
    });
    if (!independentlyMatchedTarget)
      throw new Error("Missing independently matched target fixture");
    const durableReview = await fixtures.Review({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
      name: alias.name,
      issue: "Independent match",
    });
    const durablePrice = await fixtures.StorePrice({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
      name: alias.name,
      volume: 1000,
    });

    await onBottleAliasChange({ name: release.fullName });

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, durableReview.id),
      }),
    ).toMatchObject({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, durablePrice.id),
      }),
    ).toMatchObject({
      bottleId: independentlyMatchedBottle.id,
      releaseId: null,
      targetId: independentlyMatchedTarget.id,
    });
    expect(workerClient.runJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: release.fullName,
    });
  });

  test("rejects a targetless release owned by another Bottle", async ({
    fixtures,
  }) => {
    const retainedBottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const otherRelease = await fixtures.BottleRelease({
      bottleId: otherBottle.id,
    });
    const alias = await fixtures.BottleAlias({
      bottleId: retainedBottle.id,
      releaseId: otherRelease.id,
      targetId: null,
      name: "Invalid targetless release alias",
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });

    await expect(onBottleAliasChange({ name: alias.name })).rejects.toThrow(
      CatalogTargetInvalidMappingError,
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
    expect(workerClient.runJob).not.toHaveBeenCalled();
  });

  test("delegates canonical exact reservation propagation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: (targets, { eq }) => eq(targets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Missing exact target fixture");
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Target-aware worker alias",
      assignmentSource: "canonical",
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });

    await onBottleAliasChange({ name: alias.name });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: target.id,
    });
    expect(workerClient.runJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
  });

  test("delegates a generic target only with its retained legacy pair", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { and, eq, isNull }) =>
        and(eq(targets.groupId, parent.groupId!), isNull(targets.bottleId)),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: null,
      targetId: genericTarget.id,
      name: "Retained generic worker alias",
      assignmentSource: "human_approved",
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });

    await onBottleAliasChange({ name: alias.name });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
      targetId: genericTarget.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: null,
      targetId: genericTarget.id,
    });
  });

  test("rejects a generic target that does not match its retained pair", async ({
    fixtures,
  }) => {
    const retainedParent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: retainedParent.id });
    const otherParent = await fixtures.Bottle();
    const otherGenericTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { and, eq, isNull }) =>
        and(
          eq(targets.groupId, otherParent.groupId!),
          isNull(targets.bottleId),
        ),
    });
    if (!otherGenericTarget)
      throw new Error("Missing other generic target fixture");
    const alias = await fixtures.BottleAlias({
      bottleId: retainedParent.id,
      releaseId: null,
      targetId: otherGenericTarget.id,
      name: "Mismatched generic worker alias",
      assignmentSource: "human_approved",
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
    });

    await expect(onBottleAliasChange({ name: alias.name })).rejects.toThrow(
      "the retained alias pair does not resolve to its generic target",
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
    expect(workerClient.runJob).not.toHaveBeenCalled();
  });

  test("does not overwrite a source-approved promoted-release pair", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        createdByActorId: parent.createdByActorId,
        name: "Worker promoted Bottle",
        fullName: "Worker promoted Bottle",
      })
      .returning();
    if (!promotedBottle) throw new Error("Unable to create promoted Bottle");
    const [promotedTarget] = await db
      .insert(catalogTargets)
      .values({
        groupId: parent.groupId!,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!promotedTarget) throw new Error("Unable to create promoted target");
    const alias = await fixtures.BottleAlias({
      bottleId: promotedBottle.id,
      releaseId: null,
      targetId: promotedTarget.id,
      name: "Source-approved promoted alias",
      assignmentSource: "source_approved",
    });
    const review = await fixtures.Review({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: promotedTarget.id,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: parent.id,
      targetId: promotedTarget.id,
      name: alias.name,
    });
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, price.id));
    const targetlessReview = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
      issue: "Targetless replay guard",
    });
    const targetlessPrice = await fixtures.StorePrice({
      bottleId: null,
      releaseId: null,
      targetId: null,
      name: alias.name,
      volume: 1000,
    });

    await onBottleAliasChange({ name: alias.name });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: promotedTarget.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: promotedTarget.id,
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, targetlessReview.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, targetlessPrice.id),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
  });
});

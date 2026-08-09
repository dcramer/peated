import type serverConfig from "@peated/server/config";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  changes,
} from "@peated/server/db/schema";
import { createBottle } from "@peated/server/lib/createBottle";
import { getStructuredResponse } from "@peated/server/lib/openai";
import * as testFixtures from "@peated/server/lib/test/fixtures";
import { updateBottle } from "@peated/server/lib/updateBottle";
import * as workerClient from "@peated/server/worker/client";
import { and, asc, eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";
import generateBottleDetails, {
  type GeneratedBottleDetails,
} from "./generateBottleDetails";

vi.mock("@peated/server/config", async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof serverConfig }>();
  return {
    default: {
      ...actual.default,
      AI_GATEWAY_API_KEY: "test-api-key",
    },
  };
});

vi.mock("@peated/server/lib/openai", () => ({
  getStructuredResponse: vi.fn(),
}));

function contextFor(user: User) {
  return {
    user,
  } as Parameters<typeof createBottle>[0]["context"];
}

function generatedDetails(): GeneratedBottleDetails {
  return {
    description: "Generated description",
    tastingNotes: {
      nose: "Generated nose",
      palate: "Generated palate",
      finish: "Generated finish",
    },
    category: "single_malt",
    suggestedTags: [],
    flavorProfile: "peated",
  };
}

function deferModelResult() {
  const deferred = Promise.withResolvers<GeneratedBottleDetails | null>();
  vi.mocked(getStructuredResponse).mockImplementation(
    async () => await deferred.promise,
  );
  return deferred;
}

async function createTwoMemberGroup(user: User, brandId: number) {
  const source = await createBottle({
    context: contextFor(user),
    input: {
      stable: {
        name: "Generated Details",
        brand: brandId,
        category: "single_malt",
      },
      exact: {
        edition: "Batch 1",
      },
    },
  });
  const siblingBottle = await testFixtures.BottleGroupMember({
    groupId: source.group.id,
    edition: "Batch 2",
    description: "Sibling description",
    tastingNotes: {
      nose: "Sibling nose",
      palate: "Sibling palate",
      finish: "Sibling finish",
    },
  });
  await db
    .update(bottles)
    .set({ suggestedTags: ["sibling-tag"] })
    .where(eq(bottles.id, siblingBottle.id));
  vi.mocked(workerClient.pushUniqueJob).mockClear();
  return { source, sibling: { bottle: siblingBottle } };
}

beforeEach(() => {
  vi.mocked(getStructuredResponse).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockClear();
});

test("rejects an unassigned Bottle before invoking AI", async ({
  fixtures,
}) => {
  const bottle = await fixtures.LegacyBottle();

  await expect(generateBottleDetails({ bottleId: bottle.id })).rejects.toThrow(
    `Bottle ${bottle.id} does not belong to an active BottleGroup.`,
  );
  expect(getStructuredResponse).not.toHaveBeenCalled();
});

test("rejects a Bottle tombstone before invoking AI", async ({ fixtures }) => {
  const retiredBottle = await fixtures.Bottle();
  const bottleDestination = await fixtures.Bottle();
  await db.insert(bottleTombstones).values({
    bottleId: retiredBottle.id,
    newBottleId: bottleDestination.id,
  });

  await expect(
    generateBottleDetails({ bottleId: retiredBottle.id }),
  ).rejects.toThrow(
    `Bottle ${retiredBottle.id} does not belong to an active BottleGroup.`,
  );
  expect(getStructuredResponse).not.toHaveBeenCalled();
});

test("fans out generated details and keeps exact content selected-only", async ({
  defaults,
  fixtures,
}) => {
  const brand = await fixtures.Entity({ name: "Generated Details Brand" });
  const smoke = await fixtures.Tag({ name: "smoke" });
  const fruit = await fixtures.Tag({ name: "fruit" });
  const { source, sibling } = await createTwoMemberGroup(
    defaults.user,
    brand.id,
  );
  vi.mocked(getStructuredResponse).mockResolvedValue({
    description: "Generated description",
    tastingNotes: {
      nose: "Generated nose",
      palate: "Generated palate",
      finish: "Generated finish",
    },
    category: "single_malt",
    suggestedTags: [smoke.name, fruit.name],
    flavorProfile: "peated",
  });

  await generateBottleDetails({ bottleId: source.bottle.id });

  const [selectedAfter, siblingAfter] = await db
    .select()
    .from(bottles)
    .where(
      and(eq(bottles.groupId, source.group.id), eq(bottles.brandId, brand.id)),
    )
    .orderBy(asc(bottles.id));
  expect(selectedAfter).toMatchObject({
    id: source.bottle.id,
    description: "Generated description",
    descriptionSrc: "generated",
    tastingNotes: {
      nose: "Generated nose",
      palate: "Generated palate",
      finish: "Generated finish",
    },
    suggestedTags: ["smoke", "fruit"],
    flavorProfile: "peated",
  });
  expect(siblingAfter).toMatchObject({
    id: sibling.bottle.id,
    description: "Sibling description",
    tastingNotes: {
      nose: "Sibling nose",
      palate: "Sibling palate",
      finish: "Sibling finish",
    },
    suggestedTags: ["sibling-tag"],
    flavorProfile: "peated",
  });
  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, source.group.id),
      columns: { flavorProfile: true },
    }),
  ).toEqual({ flavorProfile: "peated" });

  const updateAudits = await db
    .select()
    .from(changes)
    .where(and(eq(changes.objectType, "bottle"), eq(changes.type, "update")))
    .orderBy(asc(changes.objectId));
  expect(updateAudits).toHaveLength(2);
  expect(updateAudits[0]).toMatchObject({
    objectId: source.bottle.id,
    data: {
      updateScope: "mixed",
      creationSource: "repair_workflow",
      flavorProfile: "peated",
      description: "Generated description",
      descriptionSrc: "generated",
      suggestedTags: ["smoke", "fruit"],
    },
  });
  expect(updateAudits[1]).toMatchObject({
    objectId: sibling.bottle.id,
    data: {
      updateScope: "shared",
      creationSource: "repair_workflow",
      flavorProfile: "peated",
    },
  });
  expect(updateAudits[1]?.data).not.toHaveProperty("description");
  expect(updateAudits[1]?.data).not.toHaveProperty("tastingNotes");
  expect(updateAudits[1]?.data).not.toHaveProperty("suggestedTags");

  expect(workerClient.pushUniqueJob).toHaveBeenCalledTimes(2);
  for (const bottleId of [source.bottle.id, sibling.bottle.id]) {
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId,
    });
  }
});

test("preserves a concurrent moderator exact-content edit", async ({
  defaults,
  fixtures,
}) => {
  const mod = await fixtures.User({ mod: true });
  const brand = await fixtures.Entity({ name: "Generated Exact Race Brand" });
  const { source } = await createTwoMemberGroup(defaults.user, brand.id);
  const deferred = deferModelResult();
  const work = generateBottleDetails({ bottleId: source.bottle.id });
  await vi.waitFor(() => expect(getStructuredResponse).toHaveBeenCalledOnce());

  await updateBottle({
    bottleId: source.bottle.id,
    input: {
      exact: {
        description: "Moderator description",
        tastingNotes: {
          nose: "Moderator nose",
          palate: "Moderator palate",
          finish: "Moderator finish",
        },
      },
    },
    context: contextFor(mod),
  });
  vi.mocked(workerClient.pushUniqueJob).mockClear();

  deferred.resolve(generatedDetails());
  await expect(work).resolves.toBeUndefined();

  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, source.bottle.id),
      columns: {
        description: true,
        tastingNotes: true,
        suggestedTags: true,
        flavorProfile: true,
      },
    }),
  ).toEqual({
    description: "Moderator description",
    tastingNotes: {
      nose: "Moderator nose",
      palate: "Moderator palate",
      finish: "Moderator finish",
    },
    suggestedTags: [],
    flavorProfile: null,
  });
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});

test("discards generated work planned from stale exact identity", async ({
  defaults,
  fixtures,
}) => {
  const mod = await fixtures.User({ mod: true });
  const brand = await fixtures.Entity({
    name: "Generated Identity Race Brand",
  });
  const { source } = await createTwoMemberGroup(defaults.user, brand.id);
  const deferred = deferModelResult();
  const work = generateBottleDetails({ bottleId: source.bottle.id });
  await vi.waitFor(() => expect(getStructuredResponse).toHaveBeenCalledOnce());

  await updateBottle({
    bottleId: source.bottle.id,
    input: {
      exact: {
        edition: "Moderator Edition",
        statedAge: 12,
      },
    },
    context: contextFor(mod),
  });
  const moderatorBottle = await db.query.bottles.findFirst({
    where: eq(bottles.id, source.bottle.id),
  });
  if (!moderatorBottle) throw new Error("Expected updated Bottle.");
  vi.mocked(workerClient.pushUniqueJob).mockClear();

  deferred.resolve(generatedDetails());
  await expect(work).resolves.toBeUndefined();

  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, source.bottle.id),
      columns: {
        fullName: true,
        statedAge: true,
        edition: true,
        description: true,
        tastingNotes: true,
        suggestedTags: true,
        flavorProfile: true,
      },
    }),
  ).toEqual({
    fullName: moderatorBottle.fullName,
    statedAge: 12,
    edition: "Moderator Edition",
    description: null,
    tastingNotes: null,
    suggestedTags: [],
    flavorProfile: null,
  });
  expect(moderatorBottle.fullName).not.toBe(source.bottle.fullName);
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});

test("preserves a concurrent moderator shared-flavor edit", async ({
  defaults,
  fixtures,
}) => {
  const mod = await fixtures.User({ mod: true });
  const brand = await fixtures.Entity({ name: "Generated Shared Race Brand" });
  const { source, sibling } = await createTwoMemberGroup(
    defaults.user,
    brand.id,
  );
  const deferred = deferModelResult();
  const work = generateBottleDetails({ bottleId: source.bottle.id });
  await vi.waitFor(() => expect(getStructuredResponse).toHaveBeenCalledOnce());

  await updateBottle({
    bottleId: source.bottle.id,
    input: { shared: { flavorProfile: "lightly_peated" } },
    context: contextFor(mod),
  });
  vi.mocked(workerClient.pushUniqueJob).mockClear();

  deferred.resolve(generatedDetails());
  await expect(work).resolves.toBeUndefined();

  expect(
    await db
      .select({ id: bottles.id, flavorProfile: bottles.flavorProfile })
      .from(bottles)
      .where(eq(bottles.groupId, source.group.id))
      .orderBy(asc(bottles.id)),
  ).toEqual([
    { id: source.bottle.id, flavorProfile: "lightly_peated" },
    { id: sibling.bottle.id, flavorProfile: "lightly_peated" },
  ]);
  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, source.group.id),
      columns: { flavorProfile: true },
    }),
  ).toEqual({ flavorProfile: "lightly_peated" });
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});

test("discards generated work planned from stale shared authority", async ({
  defaults,
  fixtures,
}) => {
  const brand = await fixtures.Entity({
    name: "Generated Shared Authority Race Brand",
  });
  const { source } = await createTwoMemberGroup(defaults.user, brand.id);
  const deferred = deferModelResult();
  const work = generateBottleDetails({ bottleId: source.bottle.id });
  await vi.waitFor(() => expect(getStructuredResponse).toHaveBeenCalledOnce());

  await db
    .update(bottleGroups)
    .set({ name: "New shared authority" })
    .where(eq(bottleGroups.id, source.group.id));
  vi.mocked(workerClient.pushUniqueJob).mockClear();

  deferred.resolve(generatedDetails());
  await expect(work).resolves.toBeUndefined();

  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, source.group.id),
      columns: { name: true, flavorProfile: true },
    }),
  ).toEqual({ name: "New shared authority", flavorProfile: null });
  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, source.bottle.id),
      columns: { description: true, tastingNotes: true },
    }),
  ).toEqual({ description: null, tastingNotes: null });
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});

test("does not fan out after the selected Bottle moves groups", async ({
  defaults,
  fixtures,
}) => {
  const brand = await fixtures.Entity({
    name: "Generated Membership Race Brand",
  });
  const { source, sibling } = await createTwoMemberGroup(
    defaults.user,
    brand.id,
  );
  const destination = await createBottle({
    context: contextFor(defaults.user),
    input: {
      stable: {
        name: "Generated Membership Destination",
        brand: brand.id,
        category: "single_malt",
      },
      exact: { edition: "Destination" },
    },
  });
  const deferred = deferModelResult();
  const work = generateBottleDetails({ bottleId: source.bottle.id });
  await vi.waitFor(() => expect(getStructuredResponse).toHaveBeenCalledOnce());

  await db
    .update(bottleGroups)
    .set({ representativeBottleId: null })
    .where(eq(bottleGroups.id, source.group.id));
  await db
    .update(bottles)
    .set({ groupId: destination.group.id })
    .where(eq(bottles.id, source.bottle.id));
  vi.mocked(workerClient.pushUniqueJob).mockClear();

  deferred.resolve(generatedDetails());
  await expect(work).resolves.toBeUndefined();

  expect(
    await db
      .select({
        id: bottles.id,
        description: bottles.description,
        flavorProfile: bottles.flavorProfile,
      })
      .from(bottles)
      .where(
        and(eq(bottles.brandId, brand.id), eq(bottles.category, "single_malt")),
      )
      .orderBy(asc(bottles.id)),
  ).toEqual([
    {
      id: source.bottle.id,
      description: null,
      flavorProfile: null,
    },
    {
      id: sibling.bottle.id,
      description: "Sibling description",
      flavorProfile: null,
    },
    {
      id: destination.bottle.id,
      description: null,
      flavorProfile: null,
    },
  ]);
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});

test("rejects invalid shared authority before invoking AI", async ({
  defaults,
  fixtures,
}) => {
  const brand = await fixtures.Entity({ name: "Generated Rollback Brand" });
  const { source } = await createTwoMemberGroup(defaults.user, brand.id);
  await db
    .update(bottleGroups)
    .set({ representativeBottleId: null })
    .where(eq(bottleGroups.id, source.group.id));

  await expect(
    generateBottleDetails({ bottleId: source.bottle.id }),
  ).rejects.toThrow(`Bottle ${source.bottle.id} has invalid shared authority.`);

  expect(
    await db.query.bottles.findFirst({
      where: eq(bottles.id, source.bottle.id),
      columns: {
        description: true,
        tastingNotes: true,
        suggestedTags: true,
        flavorProfile: true,
      },
    }),
  ).toEqual({
    description: null,
    tastingNotes: null,
    suggestedTags: [],
    flavorProfile: null,
  });
  expect(
    await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, source.group.id),
      columns: { flavorProfile: true },
    }),
  ).toEqual({ flavorProfile: null });
  expect(
    await db
      .select()
      .from(changes)
      .where(and(eq(changes.objectType, "bottle"), eq(changes.type, "update"))),
  ).toEqual([]);
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  expect(getStructuredResponse).not.toHaveBeenCalled();
});

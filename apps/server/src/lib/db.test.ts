import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { bottleAliases } from "../db/schema";
import { getUserActor, getUserActorByIdForDatabase } from "./actors";
import { upsertBottleAlias } from "./db";

describe("upsertBottleAlias", () => {
  test("does not change conflicting alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const originalAssignedBy = await fixtures.User({ mod: true });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedById: originalAssignedBy.id,
    });
    const newBottle = await fixtures.Bottle({ name: "B" });
    const newBottleActor = await getUserActorByIdForDatabase(
      db,
      newBottle.createdById,
    );
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id, null, {
      assignmentSource: "source_approved",
      assignedById: newBottle.createdById,
      assignedByActorId: newBottleActor.id,
    });
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(bottle.id);
    expect(result.name).toEqual(alias.name);
    expect(result.assignmentSource).toEqual("human_approved");
    expect(result.assignedById).toEqual(originalAssignedBy.id);

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase()),
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });

  test("works with existing bound row", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });

    const result = await upsertBottleAlias(db, alias.name, bottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(bottle.id);
    expect(result.name).toEqual(alias.name);

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase()),
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });

  test("updates provenance for existing bound row when target matches", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const actor = await getUserActorByIdForDatabase(db, bottle.createdById);
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      assignmentSource: "legacy",
    });

    const result = await upsertBottleAlias(db, alias.name, bottle.id, null, {
      assignmentSource: "source_approved",
      assignedById: bottle.createdById,
      assignedByActorId: actor.id,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedById: bottle.createdById,
      assignedByActorId: actor.id,
    });
  });

  test("updates provenance when claiming a release for the same bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const actor = await getUserActorByIdForDatabase(db, bottle.createdById);
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: null,
      assignmentSource: "legacy",
      assignedById: null,
    });

    const result = await upsertBottleAlias(
      db,
      alias.name,
      bottle.id,
      release.id,
      {
        assignmentSource: "canonical",
        assignedById: bottle.createdById,
        assignedByActorId: actor.id,
      },
    );

    expect(result).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      assignmentSource: "canonical",
      assignedById: bottle.createdById,
      assignedByActorId: actor.id,
    });
  });

  test("can explicitly clear assignment attribution for the same target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const assignedBy = await fixtures.User({ mod: true });
    const assignedByActor = await getUserActor(assignedBy);
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedById: assignedBy.id,
    });

    const result = await upsertBottleAlias(db, alias.name, bottle.id, null, {
      assignmentSource: "canonical",
      assignedById: null,
      assignedByActorId: assignedByActor.id,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "canonical",
      assignedById: null,
      assignedByActorId: assignedByActor.id,
    });
  });

  test("works with existing unbound row", async ({ fixtures }) => {
    const otherAlias = await fixtures.BottleAlias({
      bottleId: null,
      name: "A",
    });

    const result = await upsertBottleAlias(db, "A cool name");
    expect(result).toBeDefined();
    expect(result.bottleId).toBeNull();

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase()),
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });

  test("creates unbound alias reservations with legacy provenance", async () => {
    const result = await upsertBottleAlias(db, "Unbound Placeholder");
    expect(result).toMatchObject({
      bottleId: null,
      assignmentSource: "legacy",
      assignedById: null,
    });
  });

  test("binds alias without conflict", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias({ bottleId: null });
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });
    const newBottle = await fixtures.Bottle({ name: "B" });
    const actor = await getUserActorByIdForDatabase(db, newBottle.createdById);

    const result = await upsertBottleAlias(db, alias.name, newBottle.id, null, {
      assignmentSource: "canonical",
      assignedById: newBottle.createdById,
      assignedByActorId: actor.id,
    });
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(newBottle.id);
    expect(result.name).toEqual(alias.name);
    expect(result.assignmentSource).toBe("canonical");
    expect(result.assignedById).toBe(newBottle.createdById);
    expect(result.assignedByActorId).toBe(actor.id);

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase()),
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });

  test("creates a new row for a new alias", async ({ fixtures }) => {
    const otherAlias = await fixtures.BottleAlias({
      name: "A",
      bottleId: null,
    });
    const newBottle = await fixtures.Bottle({ name: "B" });

    const result = await upsertBottleAlias(db, newBottle.name, newBottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(newBottle.id);
    expect(result.name).toEqual(newBottle.name);

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase()),
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });
});

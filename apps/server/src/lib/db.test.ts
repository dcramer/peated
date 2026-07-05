import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { bottleAliases } from "../db/schema";
import { getUserActor } from "./actors";
import { upsertBottleAlias } from "./db";

describe("upsertBottleAlias", () => {
  test("does not change conflicting alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const originalAssignedBy = await fixtures.User({ mod: true });
    const originalAssignedByActor = await getUserActor(originalAssignedBy);
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedByActorId: originalAssignedByActor.id,
    });
    const newBottle = await fixtures.Bottle({ name: "B" });
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id, null, {
      assignmentSource: "source_approved",
      assignedByActorId: newBottle.createdByActorId,
    });
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(bottle.id);
    expect(result.name).toEqual(alias.name);
    expect(result.assignmentSource).toEqual("human_approved");
    expect(result.assignedByActorId).toEqual(originalAssignedByActor.id);

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

    const result = await upsertBottleAlias(db, alias.name, bottle.id, null, {
      assignedByActorId: bottle.createdByActorId,
    });
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
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      assignmentSource: "legacy",
    });

    const result = await upsertBottleAlias(db, alias.name, bottle.id, null, {
      assignmentSource: "source_approved",
      assignedByActorId: bottle.createdByActorId,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedByActorId: bottle.createdByActorId,
    });
  });

  test("does not downgrade existing assignment source when only actor is supplied", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const assignedBy = await fixtures.User({ mod: true });
    const assignedByActor = await getUserActor(assignedBy);
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedByActorId: assignedByActor.id,
    });

    const result = await upsertBottleAlias(db, alias.name, bottle.id, null, {
      assignedByActorId: bottle.createdByActorId,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedByActorId: bottle.createdByActorId,
    });
  });

  test("updates provenance when claiming a release for the same bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: null,
      assignmentSource: "legacy",
    });

    const result = await upsertBottleAlias(
      db,
      alias.name,
      bottle.id,
      release.id,
      {
        assignmentSource: "canonical",
        assignedByActorId: bottle.createdByActorId,
      },
    );

    expect(result).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      assignmentSource: "canonical",
      assignedByActorId: bottle.createdByActorId,
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
    });

    const result = await upsertBottleAlias(db, alias.name, bottle.id, null, {
      assignmentSource: "canonical",
      assignedByActorId: assignedByActor.id,
    });

    expect(result).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "canonical",
      assignedByActorId: assignedByActor.id,
    });
  });

  test("works with existing unbound row", async ({ fixtures }) => {
    const otherAlias = await fixtures.BottleAlias({
      bottleId: null,
      name: "A",
    });

    const bottle = await fixtures.Bottle();
    const result = await upsertBottleAlias(db, "A cool name", null, null, {
      assignedByActorId: bottle.createdByActorId,
    });
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

  test("creates unbound alias reservations with legacy provenance", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const result = await upsertBottleAlias(
      db,
      "Unbound Placeholder",
      null,
      null,
      { assignedByActorId: bottle.createdByActorId },
    );
    expect(result).toMatchObject({
      bottleId: null,
      assignmentSource: "legacy",
    });
  });

  test("binds alias without conflict", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias({ bottleId: null });
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });
    const newBottle = await fixtures.Bottle({ name: "B" });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id, null, {
      assignmentSource: "canonical",
      assignedByActorId: newBottle.createdByActorId,
    });
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(newBottle.id);
    expect(result.name).toEqual(alias.name);
    expect(result.assignmentSource).toBe("canonical");
    expect(result.assignedByActorId).toBe(newBottle.createdByActorId);

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

    const result = await upsertBottleAlias(
      db,
      newBottle.name,
      newBottle.id,
      null,
      { assignedByActorId: newBottle.createdByActorId },
    );
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

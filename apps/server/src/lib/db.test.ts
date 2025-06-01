import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { bottleAliases } from "../db/schema";
import { upsertBottleAlias } from "./db";

describe("upsertBottleAlias", () => {
  test("does not change conflicting alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });
    const newBottle = await fixtures.Bottle({ name: "B" });
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(bottle.id);
    expect(result.name).toEqual(alias.name);

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase())
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
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase())
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
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
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase())
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });

  test("binds alias without conflict", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias({ bottleId: null });
    const otherAlias = await fixtures.BottleAlias({ bottleId: null });
    const newBottle = await fixtures.Bottle({ name: "B" });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(newBottle.id);
    expect(result.name).toEqual(alias.name);

    const [newOtherAlias] = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase())
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
        eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase())
      );
    expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
  });
});

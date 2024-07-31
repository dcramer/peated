import { db } from "../db";
import { upsertBottleAlias } from "./db";

describe("upsertBottleAlias", () => {
  test("does not change conflicting alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });
    const newBottle = await fixtures.Bottle({ name: "B" });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(bottle.id);
    expect(result.name).toEqual(alias.name);
  });

  test("works with existing bound row", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "A" });
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    const result = await upsertBottleAlias(db, alias.name, bottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(bottle.id);
    expect(result.name).toEqual(alias.name);
  });

  test("works with existing unbound row", async ({ fixtures }) => {
    const result = await upsertBottleAlias(db, "A cool name");
    expect(result).toBeDefined();
    expect(result.bottleId).toBeNull();
  });

  test("binds alias without conflict", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias({ bottleId: null });
    const newBottle = await fixtures.Bottle({ name: "B" });

    const result = await upsertBottleAlias(db, alias.name, newBottle.id);
    expect(result).toBeDefined();
    expect(result.bottleId).toEqual(newBottle.id);
    expect(result.name).toEqual(alias.name);
  });
});

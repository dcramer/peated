import { eq } from "drizzle-orm";
import { db } from "../db";
import { entities } from "../db/schema";
import { getUserActor } from "./actors";
import { findEntityByExactNameOrReference, upsertEntity } from "./db";

describe("findEntityByExactNameOrReference", () => {
  test("prefers an Entity name over another Entity's short name", async ({
    fixtures,
  }) => {
    await fixtures.Entity({
      name: "Short Name Owner",
      shortName: "Shared Entity Name",
    });
    const nameOwner = await fixtures.Entity({ name: "Shared Entity Name" });

    const result = await findEntityByExactNameOrReference(
      db,
      "Shared Entity Name",
    );

    expect(result?.id).toBe(nameOwner.id);
  });
});

describe("upsertEntity", () => {
  test("reuses an existing Entity without changing its kind", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const entity = await fixtures.Entity({
      name: "Existing Kind Candidate",
      kind: "company",
    });
    const input = {
      db,
      data: { name: entity.name },
      createdByActorId: actor.id,
      kind: "brand" as const,
    };

    const first = await upsertEntity(input);
    expect(first).toMatchObject({
      id: entity.id,
      created: false,
      changed: false,
      result: { kind: "company" },
    });
    expect(
      await db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).toMatchObject({ kind: "company", type: [] });

    const repeated = await upsertEntity(input);
    expect(repeated).toMatchObject({
      id: entity.id,
      created: false,
      changed: false,
      result: { kind: "company" },
    });
  });
});

import { eq } from "drizzle-orm";
import { db } from "../db";
import { entities } from "../db/schema";
import { getUserActor } from "./actors";
import { upsertEntity } from "./db";

describe("upsertEntity", () => {
  test("reports an existing entity role addition exactly once", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const entity = await fixtures.Entity({
      name: "Existing Role Candidate",
      type: [],
    });
    const input = {
      db,
      data: { name: entity.name },
      userId: user.id,
      createdByActorId: actor.id,
      type: "brand" as const,
    };

    const first = await upsertEntity(input);
    expect(first).toMatchObject({
      id: entity.id,
      created: false,
      changed: true,
      result: { type: ["brand"] },
    });
    expect(
      await db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).toMatchObject({ type: ["brand"] });

    const repeated = await upsertEntity(input);
    expect(repeated).toMatchObject({
      id: entity.id,
      created: false,
      changed: false,
      result: { type: ["brand"] },
    });
  });
});

import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { expect, test } from "vitest";
import indexEntitySearchVectors from "./indexEntitySearchVectors";

test("writes an Entity search document that TIN can query", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Springbank Distillers",
    shortName: "Springbank",
  });
  await fixtures.EntityReference({
    entityId: entity.id,
    name: "J & A Mitchell",
  });
  await db
    .update(entities)
    .set({ searchNames: "" })
    .where(eq(entities.id, entity.id));

  await indexEntitySearchVectors({ entityId: entity.id });

  const [row] = await db
    .select({ searchNames: entities.searchNames })
    .from(entities)
    .where(eq(entities.id, entity.id));
  expect(row!.searchNames.split("\n")).toEqual([
    "Springbank Distillers",
    "Springbank",
    "J & A Mitchell",
  ]);
  const matches = await db
    .select({ id: entities.id })
    .from(entities)
    .where(sql`${entities.searchNames} ==> ${'"mitchell"'}`);
  expect(matches.map((match) => match.id)).toEqual([entity.id]);
});

test("skips stale work for a deleted Entity", async () => {
  await expect(
    indexEntitySearchVectors({ entityId: 2_147_483_647 }),
  ).resolves.toBeUndefined();
});

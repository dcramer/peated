import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReferences,
  bottleTombstones,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

beforeEach(() => vi.resetAllMocks());

describe("Bottle aliases", () => {
  test("moderators add display aliases without creating exact references", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      fullName: "SMWS 1.234 Hello World",
    });
    const moderator = await fixtures.User({ mod: true });

    const alias = await routerClient.bottleAliases.create(
      { bottle: bottle.id, name: "SMWS 1.234 Foo   Bar" },
      { context: { user: moderator } },
    );

    expect(alias.name).toBe("SMWS 1.234 Foo Bar");
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, alias.name),
      }),
    ).resolves.toBeUndefined();
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("rejects public writes, canonical names, and equivalent duplicates", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ fullName: "Canonical Name" });
    const moderator = await fixtures.User({ mod: true });
    const user = await fixtures.User();

    await expect(
      waitError(
        routerClient.bottleAliases.create(
          { bottle: bottle.id, name: "Alternate Name" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    await expect(
      waitError(
        routerClient.bottleAliases.create(
          { bottle: bottle.id, name: bottle.fullName.replace(" ", "   ") },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(
      `[Error: This is already the Bottle's primary name.]`,
    );

    await routerClient.bottleAliases.create(
      { bottle: bottle.id, name: "Alternate Market Name" },
      { context: { user: moderator } },
    );
    await expect(
      waitError(
        routerClient.bottleAliases.create(
          { bottle: bottle.id, name: "Alternate   Market Name" },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(
      `[Error: This Bottle already has that name.]`,
    );
  });

  test("allows the same alias on different Bottles", async ({ fixtures }) => {
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.create(
      { bottle: first.id, name: "Shared Market Name" },
      { context: { user: moderator } },
    );
    await routerClient.bottleAliases.create(
      { bottle: second.id, name: "Shared Market Name" },
      { context: { user: moderator } },
    );

    const rows = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.name, "Shared Market Name"));
    expect(rows).toHaveLength(2);
  });

  test("details and tombstone reads expose sorted aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({ bottleId: bottle.id, name: "Zulu Name" });
    await fixtures.BottleAlias({ bottleId: bottle.id, name: "Alpha Name" });
    await db
      .insert(bottleTombstones)
      .values({ bottleId: 987654, newBottleId: bottle.id });

    const details = await routerClient.bottles.details({ bottle: 987654 });
    expect(details.aliases).toEqual(["Alpha Name", "Zulu Name"]);
  });

  test("deleting a display alias leaves an equal exact reference active", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    const reference = await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Independent Name",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: reference.name,
    });

    await routerClient.bottleAliases.delete(
      { bottle: bottle.id, alias: alias.id },
      { context: { user: moderator } },
    );

    await expect(
      db.query.bottleAliases.findFirst({
        where: and(
          eq(bottleAliases.id, alias.id),
          eq(bottleAliases.bottleId, bottle.id),
        ),
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.id, reference.id),
      }),
    ).resolves.toMatchObject({ ignored: false, bottleId: bottle.id });
  });
});

import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { createPostgresClient, waitForSessionBlockedBy } from "./testUtils";

const EMBEDDING = Array.from({ length: 3072 }, () => 0.125);

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockReset();
});

describe("PATCH /bottle-aliases/:alias", () => {
  test("updates ignored state by exact alias casing without changing its Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Ignored Alias Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      ignored: false,
      name: "Ignored Direct Alias",
    });

    const result = await routerClient.bottleAliases.update(
      {
        alias: alias.name.toUpperCase(),
        ignored: true,
      },
      { context: { user } },
    );

    expect(result).toEqual({
      name: alias.name,
      createdAt: alias.createdAt.toISOString(),
    });
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      ignored: true,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("can ignore an unresolved alias without resolving a Bottle", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User());
    const [alias] = await db
      .insert(bottleAliases)
      .values({
        bottleId: null,
        ignored: false,
        name: "Unresolved Alias",
        assignedByActorId: actor.id,
      })
      .returning();
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.update(
      { alias: alias!.name, ignored: true },
      { context: { user } },
    );

    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias!.name),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      ignored: true,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias!.name,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("does not allow a Bottle canonical name to be ignored", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Protected Canonical Alias" });

    const error = await waitError(
      routerClient.bottleAliases.update(
        { alias: bottle.fullName, ignored: true },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Cannot ignore canonical name]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, bottle.fullName),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      ignored: false,
    });
  });

  test("returns the current projection when no update is requested", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const alias = await fixtures.BottleAlias({ name: "Alias Readback" });

    await expect(
      routerClient.bottleAliases.update(
        { alias: alias.name },
        { context: { user } },
      ),
    ).resolves.toEqual({
      name: alias.name,
      createdAt: alias.createdAt.toISOString(),
    });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("rejects a stale update after the alias changes concurrently", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Concurrent Alias Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      ignored: false,
      assignmentSource: "legacy",
      name: "Concurrent Direct Alias",
    });
    const client = createPostgresClient();
    let committed = false;
    let update:
      | ReturnType<typeof routerClient.bottleAliases.update>
      | undefined;
    let error: unknown;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `UPDATE "bottle" SET "updated_at" = "updated_at" WHERE "id" = $1`,
        [bottle.id],
      );

      update = routerClient.bottleAliases.update(
        { alias: alias.name, ignored: true },
        { context: { user } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query(
        `UPDATE "bottle_alias"
         SET "assignment_source" = 'human_approved'
         WHERE "name" = $1`,
        [alias.name],
      );
      await client.query("COMMIT");
      committed = true;
      error = await waitError(update);
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await update?.catch(() => undefined);
    }

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle Alias changed while it was being updated. Retry the operation.]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      ignored: false,
      assignmentSource: "human_approved",
    });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("keeps the committed update when indexing is unavailable", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Queue Failure Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Queue Failure Alias",
      ignored: false,
      embedding: EMBEDDING,
    });
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      routerClient.bottleAliases.update(
        { alias: alias.name, ignored: true },
        { context: { user } },
      ),
    ).resolves.toEqual({
      name: alias.name,
      createdAt: alias.createdAt.toISOString(),
    });
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({ ignored: true, embedding: null });
  });

  test("returns not found for an unknown alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    await expect(
      waitError(
        routerClient.bottleAliases.update(
          { alias: "Missing Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Alias not found.]`);
  });

  test("requires moderator access", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias();
    const user = await fixtures.User();

    await expect(
      waitError(
        routerClient.bottleAliases.update(
          { alias: alias.name },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});

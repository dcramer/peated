import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockReset();
});

describe("PATCH /bottle-aliases/:name", () => {
  test("updates ignored state without changing direct or retained identity", async ({
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
      releaseId: alias.releaseId,
      targetId: alias.targetId,
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

  test("can ignore an unassigned retained alias without resolving its target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Retained Alias Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      ignored: false,
      name: "Retained Target Only Alias",
    });
    await db
      .update(bottleAliases)
      .set({ bottleId: null })
      .where(eq(bottleAliases.name, alias.name));

    await routerClient.bottleAliases.update(
      { alias: alias.name, ignored: true },
      { context: { user } },
    );

    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      targetId: expect.any(Number),
      ignored: true,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("does not allow the direct Bottle canonical name to be ignored", async ({
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

  test("keeps the committed update when indexing is unavailable", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Queue Failure Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Queue Failure Alias",
      ignored: false,
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
    ).resolves.toMatchObject({ ignored: true });
  });

  test("returns not found for an unknown alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.bottleAliases.update(
        { alias: "Missing Bottle Alias" },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Alias not found.]`);
  });

  test("requires moderator access", async ({ fixtures }) => {
    const alias = await fixtures.BottleAlias();
    const user = await fixtures.User();

    const error = await waitError(
      routerClient.bottleAliases.update(
        { alias: alias.name },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});

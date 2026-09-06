import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const STATS_JOB_OPTIONS = {
  delay: 5000,
  removeOnComplete: true,
  removeOnFail: false,
};

describe("PATCH /tags/:name", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });
  test("requires authentication", async ({ fixtures }) => {
    const tag = await fixtures.Tag();
    const err = await waitError(() =>
      routerClient.tags.update({
        tag: tag.name,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const tag = await fixtures.Tag();
    const user = await fixtures.User();

    const err = await waitError(() =>
      routerClient.tags.update(
        {
          tag: tag.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns 404 for non-existent tag", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.tags.update(
        {
          tag: "non-existent-tag",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tag not found.]`);
  });

  test("updates tag category", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ tagCategory: "smoke" });
    const user = await fixtures.User({ admin: true });

    const newTag = await routerClient.tags.update(
      {
        tag: tag.name,
        tagCategory: "fruit",
      },
      { context: { user } },
    );

    expect(newTag).toBeDefined();
    expect(newTag.tagCategory).toEqual("fruit");
  });

  test("updates tag synonyms", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ synonyms: ["old-synonym"] });
    const user = await fixtures.User({ admin: true });

    const newTag = await routerClient.tags.update(
      {
        tag: tag.name,
        synonyms: ["new-synonym"],
      },
      { context: { user } },
    );

    expect(newTag).toBeDefined();
    expect(newTag.synonyms).toEqual(["new-synonym"]);
  });

  test("refreshes Bottles affected by category or synonym changes", async ({
    defaults,
    fixtures,
  }) => {
    const tag = await fixtures.Tag({
      name: "smoke",
      synonyms: ["smoky"],
      tagCategory: "smoke",
    });
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: first.id,
      createdById: defaults.user.id,
      tags: ["smoky"],
    });
    await db.insert(memberReviews).values({
      bottleId: second.id,
      createdById: defaults.user.id,
      score: 88,
      tags: ["new-smoke"],
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.tags.update(
      {
        tag: tag.name,
        tagCategory: "earthy",
        synonyms: ["new-smoke"],
      },
      { context: { user } },
    );

    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    for (const bottle of [first, second]) {
      expect(workerClient.pushJob).toHaveBeenCalledWith(
        "UpdateBottleStats",
        { bottleId: bottle.id },
        STATS_JOB_OPTIONS,
      );
    }
  });

  test("no-op when no changes", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ tagCategory: "smoke" });
    const user = await fixtures.User({ admin: true });

    const newTag = await routerClient.tags.update(
      {
        tag: tag.name,
      },
      { context: { user } },
    );

    expect(newTag).toBeDefined();
    expect(newTag.tagCategory).toEqual("smoke");
  });
});

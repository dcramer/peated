import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles/:bottle/releases", () => {
  it("lists releases for a bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
      name: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "B",
      name: "B",
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "C",
      name: "C",
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(release1.id);
    expect(results[1].id).toBe(release2.id);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBe(null);
  });

  it("errors on invalid bottle", async () => {
    const err = await waitError(
      routerClient.bottleReleases.list({
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  it("filters by bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
      name: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: (await fixtures.Bottle()).id,
      edition: "B",
      name: "B",
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(release1.id);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });

  it("filters by bottle with user", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "B",
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(release1.id);
    expect(results[1].id).toBe(release2.id);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });
});

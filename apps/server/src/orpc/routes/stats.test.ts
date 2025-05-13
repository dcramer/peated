import { routerClient } from "../router";

describe("GET /stats", () => {
  test("returns stats", async ({ fixtures }) => {
    // Create some test data
    await fixtures.Tasting();
    await fixtures.Bottle();
    await fixtures.Entity();

    const data = await routerClient.stats();

    // Verify counts are at least what we created
    expect(data.totalTastings).toBeGreaterThanOrEqual(1);
    expect(data.totalBottles).toBeGreaterThanOrEqual(1);
    expect(data.totalEntities).toBeGreaterThanOrEqual(1);
  });
});

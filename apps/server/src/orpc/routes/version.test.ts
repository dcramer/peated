import config from "@peated/server/config";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /version", () => {
  test("returns version", async () => {
    const data = await routerClient.version();
    expect(data.version).toEqual(config.VERSION);
  });
});

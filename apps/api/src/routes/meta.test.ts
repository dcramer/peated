import { app } from "@peated/api/app";

describe("GET /", () => {
  test("returns version", async () => {
    const res = await app.request("/v1", {
      method: "GET",
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as { version: string };
    expect(data).toHaveProperty("version");
    expect(typeof data.version).toBe("string");
  });
});

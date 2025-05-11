import { app } from "@peated/api/app";
import { createAccessToken } from "@peated/api/lib/auth";

describe("GET /admin/queue-info", () => {
  test("requires admin access", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: false });

    const res = await app.request("/v1/admin/queue-info", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        authorization: "Bearer " + (await createAccessToken(user)),
      }),
    });

    expect(res.status).toBe(403);
  });

  test("returns queue stats", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    const res = await app.request("/v1/admin/queue-info", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        authorization: "Bearer " + (await createAccessToken(admin)),
      }),
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.stats).toEqual({
      wait: expect.any(Number),
      active: expect.any(Number),
      completed: expect.any(Number),
      failed: expect.any(Number),
    });
  });
});

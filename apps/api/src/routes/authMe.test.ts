import { app } from "@peated/api/app";
import { createAccessToken } from "@peated/api/lib/auth";

const PATH = "/v1/auth/me";

describe("GET /auth/me", () => {
  test("active sessions", async ({ fixtures }) => {
    const user = await fixtures.User();

    const res = await app.request(PATH, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        authorization: "Bearer " + (await createAccessToken(user)),
      }),
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();

    expect(data.user.id).toEqual(user.id);
  });
});

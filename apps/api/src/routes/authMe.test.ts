import app from "@peated/api/app";
import { createAccessToken } from "@peated/api/lib/auth";

// GET /auth/me endpoint tests

describe("GET /auth/me", async (t) => {
  test("returns current user when authenticated", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });
    // Simulate authentication by generating an access token
    const accessToken = await createAccessToken(user);

    const res = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res).toRespondWith(200);
    const data = res.json();
    expect(data.user.id).toEqual(user.id);
    expect(data.user.email).toEqual(user.email);
  });

  test("returns 401 when not authenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
    });
    expect(res).toRespondWith(401);
  });
});

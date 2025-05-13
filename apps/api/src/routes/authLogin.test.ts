import app from "@peated/api/app";

describe("POST /auth/login", async () => {
  test("valid credentials", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      body: {
        email: user.email,
        password: "example",
      },
    });

    expect(res).toRespondWith(200);

    const data = res.json();

    expect(data.user.id).toEqual(user.id);
    expect(data.accessToken).toBeDefined();
  });

  test("invalid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      body: {
        email: "foo@example.com",
        password: "example",
      },
    });
    expect(res).toRespondWith(401);
  });
});

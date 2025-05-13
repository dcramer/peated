import { app } from "@peated/api/app";

const PATH = "/v1/auth/login";

describe("POST /auth/login", () => {
  test("valid credentials", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        email: "foo@example.com",
        password: "example",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();

    expect(data.user.id).toEqual(user.id);
    expect(data.accessToken).toBeDefined();
  });

  test("invalid credentials", async () => {
    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        email: "foo@example.com",
        password: "definitely-not-the-password",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(401);
  });
});

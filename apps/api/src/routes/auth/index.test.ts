import { app } from "@peated/api/app";

describe("POST /auth", async (t) => {
  test("valid credentials", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const res = await app.request("/v1/auth", {
      method: "POST",
      body: JSON.stringify({
        email: "foo@example.com",
        password: "example",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
      // headers: {
      //   authorization: "Bearer " + (await createAccessToken(user)),
      // },
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();

    expect(data.user.id).toEqual(user.id);
    expect(data.accessToken).toBeDefined();
  });

  test("invalid credentials", async ({ fixtures }) => {
    // const res = await app.inject({
    //   method: "GET",
    //   url: "/auth",
    //   body: {
    //     email: "foo@example.com",
    //     password: "example",
    //   },
    // });

    const res = await app.request("/v1/auth", {
      method: "POST",
      body: JSON.stringify({
        email: "foo@example.com",
        password: "example",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(401);
  });
});

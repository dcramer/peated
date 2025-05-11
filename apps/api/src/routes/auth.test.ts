import { default as buildFastify } from "@peated/api/app";
import type { FastifyInstance } from "fastify";

describe("POST /auth", async (t) => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildFastify();
  });

  afterEach(async () => {
    app && (await app.close());
  });

  test("valid credentials", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth",
      body: {
        email: "foo@example.com",
        password: "example",
      },
      // headers: {
      //   authorization: "Bearer " + (await createAccessToken(user)),
      // },
    });

    expect(res.statusCode).toBe(200);

    const data = res.json();

    expect(data.user.id).toEqual(user.id);
    expect(data.accessToken).toBeDefined();
  });

  test("invalid credentials", async ({ fixtures }) => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth",
      body: {
        email: "foo@example.com",
        password: "example",
      },
    });
    expect(res.statusCode).toBe(401);
  });
});

import { default as buildFastify } from "@peated/api/app";
import waitError from "@peated/api/lib/test/waitError";
import type { FastifyInstance } from "fastify";

describe("GET /auth", async (t) => {
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
      method: "GET",
      url: "/auth",
      body: {
        email: "foo@example.com",
        password: "example",
      },
      // headers: {
      //   authorization: "Bearer " + (await createAccessToken(user)),
      // },
    });

    const data = res.json();

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

    const err = await waitError(
      app.inject({
        method: "GET",
        url: "/auth",
        body: {
          email: "foo@example.com",
          password: "example",
        },
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error:]`);
  });
});

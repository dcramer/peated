import { default as buildFastify } from "@peated/api/app";
import { db } from "@peated/api/db";
import { users } from "@peated/api/db/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

describe("POST /auth/register", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildFastify();
  });

  afterEach(async () => {
    app && (await app.close());
  });

  test("registers a new user", async ({ fixtures }) => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      body: {
        username: "testuser",
        email: "test@example.com",
        password: "testpassword",
      },
    });

    expect(res.statusCode).toBe(200);

    const data = res.json();
    expect(data.user.username).toBe("testuser");
    expect(data.user.email).toBe("test@example.com");
    expect(data.accessToken).toBeDefined();

    // Verify user was created in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, "testuser"));
    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
    expect(user.passwordHash).toBeDefined();
  });

  test("fails with existing username", async ({ fixtures }) => {
    const existingUser = await fixtures.User({
      username: "testuser",
      email: "existing@example.com",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      body: {
        username: "testuser",
        email: "new@example.com",
        password: "testpassword",
      },
    });

    expect(res.statusCode).toBe(409);
    const data = res.json();
    expect(data.field).toBe("username");
  });

  test("fails with existing email", async ({ fixtures }) => {
    const existingUser = await fixtures.User({
      username: "existinguser",
      email: "test@example.com",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      body: {
        username: "newuser",
        email: "test@example.com",
        password: "testpassword",
      },
    });

    expect(res.statusCode).toBe(409);
    const data = res.json();
    expect(data.field).toBe("email");
  });

  test("validates email format", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      body: {
        username: "testuser",
        email: "invalid-email",
        password: "testpassword",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  test("requires all fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      body: {
        username: "testuser",
        // missing email and password
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

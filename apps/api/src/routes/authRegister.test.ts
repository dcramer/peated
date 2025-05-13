import app from "@peated/api/app";
import { db } from "@peated/api/db";
import { users } from "@peated/api/db/schema";
import { eq } from "drizzle-orm";

describe("POST /auth/register", () => {
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

    expect(res).toRespondWith(200);

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

    expect(res).toRespondWith(409);
    expect(res.json()).toMatchInlineSnapshot(`
      {
        "code": "Conflict",
        "error": "Conflict",
        "message": "User already exists.",
        "statusCode": 409,
      }
    `);
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

    expect(res).toRespondWith(409);
    expect(res.json()).toMatchInlineSnapshot(`
      {
        "code": "Conflict",
        "error": "Conflict",
        "message": "User already exists.",
        "statusCode": 409,
      }
    `);
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

    expect(res).toRespondWith(400);
    expect(res.json()).toMatchInlineSnapshot(`
      {
        "code": "Bad Request",
        "error": "Bad Request",
        "message": "body/email Invalid email",
        "statusCode": 400,
      }
    `);
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

    expect(res).toRespondWith(400);
    expect(res.json()).toMatchInlineSnapshot(`
      {
        "code": "Bad Request",
        "error": "Bad Request",
        "message": "body/email Required, body/password Required",
        "statusCode": 400,
      }
    `);
  });
});

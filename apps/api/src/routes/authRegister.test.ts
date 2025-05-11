import { app } from "@peated/api/app";
import { db } from "@peated/api/db";
import { users } from "@peated/api/db/schema";
import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

const PATH = "/v1/auth/register";

describe("POST /auth/register", () => {
  test("valid credentials", async ({ fixtures }) => {
    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        username: "foo",
        email: "foo@example.com",
        password: "example123",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.user.id).toBeDefined();
    expect(data.accessToken).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, data.user.id));
    expect(user.username).toEqual("foo");
    expect(user.email).toEqual("foo@example.com");
    expect(user.passwordHash).not.toBeNull();
    expect(user.verified).toBe(false);
    expect(compareSync("example123", user.passwordHash as string)).toBeTruthy();
  });

  test("duplicate username", async ({ fixtures }) => {
    await fixtures.User({ username: "foo" });

    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        username: "foo",
        email: "foo@example.com",
        password: "example123",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(409);
  });

  test("duplicate email", async ({ fixtures }) => {
    await fixtures.User({ email: "foo@example.com" });

    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        username: "foobar",
        email: "foo@example.com",
        password: "example123",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(409);
  });

  test("invalid email format", async () => {
    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        username: "foo",
        email: "not-an-email",
        password: "example123",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(400);
  });

  test("password too short", async () => {
    const res = await app.request(PATH, {
      method: "POST",
      body: JSON.stringify({
        username: "foo",
        email: "foo@example.com",
        password: "short",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(400);
  });
});

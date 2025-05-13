import { sendPasswordResetEmail } from "@peated/api/lib/email";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { User as createUser } from "../lib/test/fixtures";

vi.mock("@peated/api/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

describe("POST /v1/auth/password-reset", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("sends email for valid, active user", async () => {
    const user = await createUser();
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: { email: user.email },
    });
    expect(response).toRespondWith(200);
    expect(response.json()).toEqual({});
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ user });
  });

  it("returns 404 for non-existent user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: { email: "nonexistent@example.com" },
    });
    expect(response).toRespondWith(404);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "code": "Not Found",
        "error": "Not Found",
        "message": "Account not found.",
        "statusCode": 404,
      }
    `);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for inactive user", async () => {
    const user = await createUser({ active: false });
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: { email: user.email },
    });
    expect(response).toRespondWith(404);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "code": "Not Found",
        "error": "Not Found",
        "message": "Account not found.",
        "statusCode": 404,
      }
    `);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: { email: "invalid-email" },
    });
    expect(response).toRespondWith(400);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "code": "Bad Request",
        "error": "Bad Request",
        "message": "body/email Invalid email",
        "statusCode": 400,
      }
    `);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

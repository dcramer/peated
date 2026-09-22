import { describe, expect, it } from "vitest";

import { getAccountStateRedirect } from "./auth";

const location = {
  pathname: "/bottles/1",
  searchParams: new URLSearchParams("tab=reviews"),
};

describe("getAccountStateRedirect", () => {
  it("sends a suspended member to the suspension screen", () => {
    expect(
      getAccountStateRedirect(
        { accessToken: "token", user: { suspendedAt: "2026-09-22T00:00:00Z" } },
        location,
      ),
    ).toBe("/auth/suspended");
  });

  it("keeps a member with a working session where they are", () => {
    expect(
      getAccountStateRedirect({ accessToken: "token", user: {} }, location),
    ).toBeNull();
  });

  it("sends a member whose session is gone to sign in, keeping their page", () => {
    expect(getAccountStateRedirect({ user: null }, location)).toBe(
      "/login?redirectTo=%2Fbottles%2F1%3Ftab%3Dreviews",
    );
    expect(
      getAccountStateRedirect({ accessToken: null, user: {} }, location),
    ).toBe("/login?redirectTo=%2Fbottles%2F1%3Ftab%3Dreviews");
  });
});

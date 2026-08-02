import { describe, expect, it } from "vitest";
import { getRegistrationConflictField } from "./registration";

describe("getRegistrationConflictField", () => {
  it.each(["email", "username"] as const)(
    "recognizes a structured %s conflict",
    (field) => {
      expect(
        getRegistrationConflictField({
          name: "CONFLICT",
          data: { field },
        }),
      ).toBe(field);
    },
  );

  it("ignores unrelated and malformed errors", () => {
    expect(
      getRegistrationConflictField({
        name: "INTERNAL_SERVER_ERROR",
        data: { field: "email" },
      }),
    ).toBeNull();
    expect(
      getRegistrationConflictField({
        name: "CONFLICT",
        data: { field: "password" },
      }),
    ).toBeNull();
    expect(getRegistrationConflictField(new Error("Conflict"))).toBeNull();
  });
});

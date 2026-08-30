import { describe, expect, it } from "vitest";

import { isInternalAppHref } from "./appLink";

describe("isInternalAppHref", () => {
  it.each(["/", "/bottles/123", "/users/example?tab=library"])(
    "recognizes the internal route %s",
    (href) => {
      expect(isInternalAppHref(href)).toBe(true);
    },
  );

  it.each([
    "//cdn.example.com/image.jpg",
    "https://example.com",
    "mailto:hello@example.com",
    "#main-content",
  ])("leaves the non-app target %s to the browser", (href) => {
    expect(isInternalAppHref(href)).toBe(false);
  });
});

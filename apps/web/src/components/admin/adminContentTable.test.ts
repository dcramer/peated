import { describe, expect, test } from "vitest";

import { contentAdminUrl } from "./adminContentTable.stylex";

describe("admin content links", () => {
  test("keeps each content kind on its own stable detail route", () => {
    expect(contentAdminUrl({ id: 12, kind: "member_review" })).toBe(
      "/admin/reviews/member/12",
    );
    expect(contentAdminUrl({ id: 13, kind: "external_review" })).toBe(
      "/admin/reviews/critics/13",
    );
    expect(contentAdminUrl({ id: 14, kind: "tasting" })).toBe(
      "/admin/tastings/14",
    );
  });
});

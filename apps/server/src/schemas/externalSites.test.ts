import { ExternalSiteKeySchema } from "./externalSites";

test("accepts an existing external-site key", () => {
  expect(ExternalSiteKeySchema.parse("whiskyworld")).toBe("whiskyworld");
});

test("accepts new keys and rejects malformed keys", () => {
  expect(ExternalSiteKeySchema.parse("new-review-source")).toBe(
    "new-review-source",
  );
  expect(() => ExternalSiteKeySchema.parse("Not a site key")).toThrow();
});

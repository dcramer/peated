import { ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("whiskyworld")).toBe("whiskyworld");
});

test("rejects unknown external-site types", () => {
  expect(() => ExternalSiteTypeEnum.parse("unknown-source")).toThrow();
});

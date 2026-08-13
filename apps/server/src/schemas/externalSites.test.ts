import { ExternalSiteInputSchema, ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("ncnean")).toBe("ncnean");
  expect(
    ExternalSiteInputSchema.parse({
      name: "Nc'nean",
      type: "ncnean",
    }),
  ).toMatchObject({
    name: "Nc'nean",
    type: "ncnean",
  });
});

test("rejects unknown external-site types", () => {
  expect(() => ExternalSiteTypeEnum.parse("unknown-source")).toThrow();
  expect(() =>
    ExternalSiteInputSchema.parse({
      name: "Unknown Source",
      type: "unknown-source",
    }),
  ).toThrow();
});

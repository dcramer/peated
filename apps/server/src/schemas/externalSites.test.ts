import { ExternalSiteInputSchema, ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("missionliquor")).toBe("missionliquor");
  expect(
    ExternalSiteInputSchema.parse({
      name: "Mission Liquor",
      type: "missionliquor",
    }),
  ).toMatchObject({
    name: "Mission Liquor",
    type: "missionliquor",
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

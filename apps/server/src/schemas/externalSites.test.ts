import { ExternalSiteInputSchema, ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("whiskyworld")).toBe("whiskyworld");
  expect(
    ExternalSiteInputSchema.parse({
      name: "The Whisky World",
      type: "whiskyworld",
    }),
  ).toMatchObject({
    name: "The Whisky World",
    type: "whiskyworld",
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

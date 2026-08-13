import { ExternalSiteInputSchema, ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("glenallachie")).toBe("glenallachie");
  expect(
    ExternalSiteInputSchema.parse({
      name: "The GlenAllachie",
      type: "glenallachie",
    }),
  ).toMatchObject({
    name: "The GlenAllachie",
    type: "glenallachie",
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

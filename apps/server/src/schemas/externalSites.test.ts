import { ExternalSiteInputSchema, ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("edradour")).toBe("edradour");
  expect(
    ExternalSiteInputSchema.parse({
      name: "Edradour",
      type: "edradour",
    }),
  ).toMatchObject({
    name: "Edradour",
    type: "edradour",
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

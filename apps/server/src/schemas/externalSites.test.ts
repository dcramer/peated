import { ExternalSiteInputSchema, ExternalSiteTypeEnum } from "./externalSites";

test("accepts registered external-site types", () => {
  expect(ExternalSiteTypeEnum.parse("bruichladdich")).toBe("bruichladdich");
  expect(
    ExternalSiteInputSchema.parse({
      name: "Bruichladdich",
      type: "bruichladdich",
    }),
  ).toMatchObject({
    name: "Bruichladdich",
    type: "bruichladdich",
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

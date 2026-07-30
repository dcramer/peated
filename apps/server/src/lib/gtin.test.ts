import { InvalidGtinError, normalizeGtin } from "./gtin";

describe("normalizeGtin", () => {
  test.each([
    ["96385074", "00000096385074"],
    ["036602301979", "00036602301979"],
    ["4006381333931", "04006381333931"],
    ["10012345678902", "10012345678902"],
  ])("normalizes valid %s input", (value, gtin14) => {
    expect(normalizeGtin(value)).toEqual({ value, gtin14 });
  });

  test("removes spaces and hyphens", () => {
    expect(normalizeGtin("0 36602-30197 9")).toEqual({
      value: "036602301979",
      gtin14: "00036602301979",
    });
  });

  test("normalizes equivalent UPC-A and EAN-13 values to the same key", () => {
    expect(normalizeGtin("036602301979").gtin14).toBe(
      normalizeGtin("0036602301979").gtin14,
    );
  });

  test.each([
    ["1234567", "Barcode must be a GTIN-8, GTIN-12, GTIN-13, or GTIN-14."],
    ["03660230197X", "Barcode must contain only digits, spaces, or hyphens."],
    ["036602301973", "Barcode has an invalid check digit."],
  ])("rejects invalid input %s", (value, message) => {
    expect(() => normalizeGtin(value)).toThrow(new InvalidGtinError(message));
  });
});

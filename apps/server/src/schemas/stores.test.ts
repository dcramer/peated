import { StorePriceInputSchema } from "./stores";

const validInput = {
  name: "Example Bottle",
  price: 10_000,
  currency: "usd" as const,
  volume: 750,
  url: "https://example.com/bottle",
};

describe("StorePriceInputSchema", () => {
  test.each([0, -1, 1.5])("rejects invalid price %s", (price) => {
    expect(
      StorePriceInputSchema.safeParse({ ...validInput, price }).success,
    ).toBe(false);
  });
});

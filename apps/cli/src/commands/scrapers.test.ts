import { describe, expect, test } from "vitest";
import { parsePreviewInput, parsePreviewLimit } from "./scrapers";

const rules = {
  kind: "price",
  list: {
    detailLink: { selector: "a.product", attribute: "href" },
    maxItems: 10,
  },
  detail: {
    name: { selector: "h1" },
    price: { selector: ".price" },
    currency: "usd",
    volume: { value: "700 ml" },
  },
};

describe("parsePreviewLimit", () => {
  test("accepts a bounded whole number", () => {
    expect(parsePreviewLimit("3")).toBe(3);
  });

  test.each(["0", "100", "1.5", "nope"])("rejects %s", (value) => {
    expect(() => parsePreviewLimit(value)).toThrow(
      "Preview limit must be an integer from 1 to 99.",
    );
  });
});

describe("parsePreviewInput", () => {
  test("defaults existing files to rules version 1", () => {
    expect(
      parsePreviewInput({
        listUrl: "https://example.test/products",
        rules: {
          ...rules,
          detail: { ...rules.detail, volume: { selector: ".volume" } },
        },
      }).rulesVersion,
    ).toBe(1);
  });

  test("accepts an explicit rules version for the runtime parser", () => {
    expect(
      parsePreviewInput({
        rulesVersion: 2,
        listUrl: "https://example.test/products",
        rules,
      }),
    ).toMatchObject({ rulesVersion: 2, rules });
  });
});

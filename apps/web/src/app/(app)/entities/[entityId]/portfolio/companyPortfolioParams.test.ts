import { describe, expect, it } from "vitest";

import { getCompanyPortfolioInput } from "./companyPortfolioParams";

describe("getCompanyPortfolioInput", () => {
  it("maps a URL kind to the Company portfolio contract", () => {
    expect(
      getCompanyPortfolioInput(
        1383,
        new URLSearchParams({
          cursor: "2",
          kind: "brand",
          sort: "name",
        }),
      ),
    ).toEqual({
      company: 1383,
      cursor: 2,
      kinds: ["brand"],
      limit: 25,
      sort: "name",
    });
  });

  it("drops unknown filters and uses stable defaults", () => {
    expect(
      getCompanyPortfolioInput(
        1383,
        new URLSearchParams({
          cursor: "nope",
          kind: "company",
          sort: "newest",
        }),
      ),
    ).toEqual({
      company: 1383,
      cursor: 1,
      kinds: undefined,
      limit: 25,
      sort: "-bottles",
    });
  });
});

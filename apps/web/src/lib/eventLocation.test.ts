import { describe, expect, it } from "vitest";

import { formatEventLocation } from "./eventLocation";

describe("formatEventLocation", () => {
  it("shows the city, state, and country for US events", () => {
    expect(
      formatEventLocation({
        address: "Spalding Hall, 114 N Fifth Street, Bardstown, Kentucky",
        country: {
          id: 236,
          name: "United States",
          slug: "united-states",
          totalBottles: 0,
          totalDistillers: 0,
        },
      }),
    ).toBe("Bardstown · Kentucky · United States");
  });

  it("shows the city and country without the venue", () => {
    expect(
      formatEventLocation({
        address: "UHI Moray, Moray Street, Elgin",
        country: {
          id: 198,
          name: "Scotland",
          slug: "scotland",
          totalBottles: 0,
          totalDistillers: 0,
        },
      }),
    ).toBe("Elgin · Scotland");
  });

  it("uses a broad event area without its prefix", () => {
    expect(
      formatEventLocation({
        address: "Across Speyside",
        country: {
          id: 198,
          name: "Scotland",
          slug: "scotland",
          totalBottles: 0,
          totalDistillers: 0,
        },
      }),
    ).toBe("Speyside · Scotland");
  });

  it("falls back to the country when there is no address", () => {
    expect(
      formatEventLocation({
        address: null,
        country: {
          id: 111,
          name: "Japan",
          slug: "japan",
          totalBottles: 0,
          totalDistillers: 0,
        },
      }),
    ).toBe("Japan");
  });
});

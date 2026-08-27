import { describe, expect, it } from "vitest";

import { toLeafletLatLng } from "./coordinates";

describe("toLeafletLatLng", () => {
  it("converts API longitude and latitude to Leaflet order", () => {
    expect(toLeafletLatLng([-6.126, 55.635])).toEqual([55.635, -6.126]);
  });
});

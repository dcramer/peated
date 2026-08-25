import { getAdvancedRatingBand } from "./constants";

describe("getAdvancedRatingBand", () => {
  test.each([
    [100, "Extraordinary"],
    [95, "Extraordinary"],
    [94, "Exceptional"],
    [90, "Exceptional"],
    [89, "Very good"],
    [85, "Very good"],
    [84, "Good"],
    [80, "Good"],
    [79, "Fair"],
    [75, "Fair"],
    [74, "Not recommended"],
    [0, "Not recommended"],
  ])("maps %i to %s", (score, label) => {
    expect(getAdvancedRatingBand(score)?.label).toBe(label);
  });

  test.each([-1, 101])("does not map out-of-range score %i", (score) => {
    expect(getAdvancedRatingBand(score)).toBeUndefined();
  });
});

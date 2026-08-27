import { getTastingBand } from "./constants";

describe("getTastingBand", () => {
  test.each([
    [100, "Unicorn"],
    [95, "Unicorn"],
    [94, "Outstanding"],
    [90, "Outstanding"],
    [89, "Very good"],
    [85, "Very good"],
    [84, "Good"],
    [80, "Good"],
    [79, "Mediocre"],
    [0, "Mediocre"],
  ])("maps %i to %s", (score, label) => {
    expect(getTastingBand(score)?.label).toBe(label);
  });

  test.each([-1, 101])("does not map out-of-range score %i", (score) => {
    expect(getTastingBand(score)).toBeUndefined();
  });
});

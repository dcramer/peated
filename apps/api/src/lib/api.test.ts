import { fixBottleName } from "./api";

describe("fixBottleName", () => {
  test("just the age", async () => {
    const rv = fixBottleName("10", 10);
    expect(rv).toBe("10-year-old");
  });

  test("age suffix", async () => {
    const rv = fixBottleName("Delicious 10", 10);
    expect(rv).toBe("Delicious 10-year-old");
  });

  test("age prefix", async () => {
    const rv = fixBottleName("10 Wood", 10);
    expect(rv).toBe("10-year-old Wood");
  });

  test("casing", async () => {
    const rv = fixBottleName("10-YEAR-OLD Wood", 10);
    expect(rv).toBe("10-year-old Wood");
  });

  test("plural to singular", async () => {
    const rv = fixBottleName("10-years-old Wood", 10);
    expect(rv).toBe("10-year-old Wood");
  });

  test("spacing", async () => {
    const rv = fixBottleName("10 years old Wood", 10);
    expect(rv).toBe("10-year-old Wood");

    const rv2 = fixBottleName("10 year old Wood", 10);
    expect(rv2).toBe("10-year-old Wood");
  });

  test("age without age", async () => {
    const rv = fixBottleName("10");
    expect(rv).toBe("10");
  });
});

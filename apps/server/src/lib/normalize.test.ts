import { normalizeBottleName, normalizeVolume } from "./normalize";

describe("normalizeBottleName", () => {
  test("just the age", async () => {
    const [rv, age] = normalizeBottleName("10", 10);
    expect(rv).toBe("10-year-old");
    expect(age).toBe(10);
  });

  test("age suffix", async () => {
    const [rv, age] = normalizeBottleName("Delicious 10", 10);
    expect(rv).toBe("Delicious 10-year-old");
    expect(age).toBe(10);
  });

  test("age prefix", async () => {
    const [rv, age] = normalizeBottleName("10 Wood", 10);
    expect(rv).toBe("10-year-old Wood");
    expect(age).toBe(10);
  });

  test("casing", async () => {
    const [rv, age] = normalizeBottleName("10-YEAR-OLD Wood", 10);
    expect(rv).toBe("10-year-old Wood");
    expect(age).toBe(10);
  });

  test("plural to singular", async () => {
    const [rv, age] = normalizeBottleName("10-years-old Wood", 10);
    expect(rv).toBe("10-year-old Wood");
    expect(age).toBe(10);
  });

  test("spacing", async () => {
    const [rv, age] = normalizeBottleName("10 years old Wood", 10);
    expect(rv).toBe("10-year-old Wood");
    expect(age).toBe(10);

    const [rv2, age2] = normalizeBottleName("10 year old Wood", 10);
    expect(rv2).toBe("10-year-old Wood");
    expect(age2).toBe(10);
  });

  test("12", async () => {
    const [rv, age] = normalizeBottleName("10");
    expect(rv).toBe("10");
    expect(age).toBeNull();
  });

  test("Name 12yr", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12yr");
    expect(rv).toBe("Delicious 12-year-old");
    expect(age).toBe(12);
  });

  test("Name 12yr.", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12yr.");
    expect(rv).toBe("Delicious 12-year-old");
    expect(age).toBe(12);
  });

  test("Name 12yrs", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12yrs");
    expect(rv).toBe("Delicious 12-year-old");
    expect(age).toBe(12);
  });

  test("Name 12 year", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12 year");
    expect(rv).toBe("Delicious 12-year-old");
    expect(age).toBe(12);
  });

  test("Name 12 year thing", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12 Year thing");
    expect(rv).toBe("Delicious 12-year-old thing");
    expect(age).toBe(12);
  });

  test("Cask No. 1.285 Hello World", async () => {
    const [rv, age] = normalizeBottleName("Cask No. 1.285 Hello World");
    expect(rv).toBe("1.285 Hello World");
    expect(age).toBeNull();
  });
});

describe("normalizeVolume", () => {
  test("750ml", async () => {
    const rv = normalizeVolume("750ml");
    expect(rv).toBe(750);
  });
  test("1.75L", async () => {
    const rv = normalizeVolume("1.75L");
    expect(rv).toBe(1750);
  });
  test("invalid", async () => {
    const rv = normalizeVolume("1.75");
    expect(rv).toBe(null);
  });
});

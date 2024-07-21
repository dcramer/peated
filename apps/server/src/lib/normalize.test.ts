import { normalizeBottleName, normalizeVolume } from "./normalize";

describe("normalizeBottleName", () => {
  test("just the age", async () => {
    const [rv, age] = normalizeBottleName("10", 10);
    expect(rv).toMatchInlineSnapshot(`"10-year-old"`);
    expect(age).toBe(10);
  });

  test("age suffix", async () => {
    const [rv, age] = normalizeBottleName("Delicious 10", 10);
    expect(rv).toMatchInlineSnapshot(`"Delicious 10-year-old"`);
    expect(age).toBe(10);
  });

  test("age suffix not age", async () => {
    const [rv, age] = normalizeBottleName("Delicious 10", null);
    expect(rv).toMatchInlineSnapshot(`"Delicious 10"`);
    expect(age).toBeNull();
  });

  test("age prefix", async () => {
    const [rv, age] = normalizeBottleName("10 Wood", 10);
    expect(rv).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(age).toBe(10);
  });

  test("age prefix not age", async () => {
    const [rv, age] = normalizeBottleName("10 Wood", null);
    expect(rv).toMatchInlineSnapshot(`"10 Wood"`);
    expect(age).toBeNull();
  });

  test("casing", async () => {
    const [rv, age] = normalizeBottleName("10-YEAR-OLD Wood", 10);
    expect(rv).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(age).toBe(10);
  });

  test("plural to singular", async () => {
    const [rv, age] = normalizeBottleName("10-years-old Wood", 10);
    expect(rv).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(age).toBe(10);
  });

  test("spacing", async () => {
    const [rv, age] = normalizeBottleName("10 years old Wood", 10);
    expect(rv).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(age).toBe(10);

    const [rv2, age2] = normalizeBottleName("10 year old Wood", 10);
    expect(rv).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(age2).toBe(10);
  });

  test("12", async () => {
    const [rv, age] = normalizeBottleName("10");
    expect(rv).toMatchInlineSnapshot(`"10"`);
    expect(age).toBeNull();
  });

  test("Name 12yr", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12yr");
    expect(rv).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(age).toBe(12);
  });

  test("Name 12yr.", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12yr.");
    expect(rv).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(age).toBe(12);
  });

  test("Name 12yrs", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12yrs");
    expect(rv).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(age).toBe(12);
  });

  test("Name 12 year", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12 year");
    expect(rv).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(age).toBe(12);
  });

  test("Name 12 year thing", async () => {
    const [rv, age] = normalizeBottleName("Delicious 12 Year thing");
    expect(rv).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(age).toBe(12);
  });

  test("Name twelve year thing", async () => {
    const [rv, age] = normalizeBottleName("Delicious twelve Year thing");
    expect(rv).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(age).toBe(12);
  });

  test("Name ten year thing", async () => {
    const [rv, age] = normalizeBottleName("Delicious ten Year thing");
    expect(rv).toMatchInlineSnapshot(`"Delicious 10-year-old thing"`);
    expect(age).toBe(10);
  });

  test("Name fifteen year thing", async () => {
    const [rv, age] = normalizeBottleName("Delicious fifteen Year thing");
    expect(rv).toMatchInlineSnapshot(`"Delicious 15-year-old thing"`);
    expect(age).toBe(15);
  });

  test("Cask No. 1.285 Hello World", async () => {
    const [rv, age] = normalizeBottleName("Cask No. 1.285 Hello World");
    expect(rv).toMatchInlineSnapshot(`"1.285 Hello World"`);
    expect(age).toBeNull();
  });

  test("Traigh Bhan 19-year-old Scotch Batch No. 5", async () => {
    const [rv, age] = normalizeBottleName(
      "Traigh Bhan 19-year-old Scotch Batch No. 5",
    );
    expect(rv).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(age).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch (Batch No. 5)", async () => {
    const [rv, age] = normalizeBottleName(
      "Traigh Bhan 19-year-old Scotch (Batch No. 5)",
    );
    expect(rv).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(age).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch #5", async () => {
    const [rv, age] = normalizeBottleName(
      "Traigh Bhan 19-year-old Scotch Batch #5",
    );
    expect(rv).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(age).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch 5", async () => {
    const [rv, age] = normalizeBottleName(
      "Traigh Bhan 19-year-old Scotch Batch 5",
    );
    expect(rv).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(age).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch A", async () => {
    const [rv, age] = normalizeBottleName(
      "Traigh Bhan 19-year-old Scotch Batch A",
    );
    expect(rv).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(age).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch, Batch A", async () => {
    const [rv, age] = normalizeBottleName(
      "Traigh Bhan 19-year-old Scotch, Batch A",
    );
    expect(rv).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(age).toEqual(19);
  });

  test("Small Batch Bourbon", async () => {
    const [rv, age] = normalizeBottleName("Small Batch Bourbon");
    expect(rv).toMatchInlineSnapshot(`"Small Batch Bourbon"`);
    expect(age).toBeNull();
  });

  test("Old Synergies #12", async () => {
    const [rv, age] = normalizeBottleName("Old Synergies #12");
    expect(rv).toMatchInlineSnapshot(`"Old Synergies #12"`);
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

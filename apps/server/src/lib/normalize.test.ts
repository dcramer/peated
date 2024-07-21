import { normalizeBottleName, normalizeVolume } from "./normalize";

describe("normalizeBottleName", () => {
  test("just the age", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "10",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old"`);
    expect(statedAge).toBe(10);
  });

  test("age suffix", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 10",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10-year-old"`);
    expect(statedAge).toBe(10);
  });

  test("age suffix not age", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 10",
      statedAge: null,
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10"`);
    expect(statedAge).toBeNull();
  });

  test("age prefix", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "10 Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("age prefix not age", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "10 Wood",
      statedAge: null,
    });
    expect(name).toMatchInlineSnapshot(`"10 Wood"`);
    expect(statedAge).toBeNull();
  });

  test("casing", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "10-YEAR-OLD Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("plural to singular", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "10-years-old Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("spacing", async () => {
    let { name, statedAge } = normalizeBottleName({
      name: "10 years old Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);

    ({ name, statedAge } = normalizeBottleName({
      name: "10 year old Wood",
      statedAge: 10,
    }));
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("12", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "10",
    });
    expect(name).toMatchInlineSnapshot(`"10"`);
    expect(statedAge).toBeNull();
  });

  test("Name 12yr", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 12yr",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12yr.", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 12yr.",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12yrs", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 12yrs",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12 year", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 12 year",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12 year thing", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious 12 Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(statedAge).toBe(12);
  });

  test("Name twelve year thing", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious twelve Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(statedAge).toBe(12);
  });

  test("Name ten year thing", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious ten Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10-year-old thing"`);
    expect(statedAge).toBe(10);
  });

  test("Name fifteen year thing", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Delicious fifteen Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 15-year-old thing"`);
    expect(statedAge).toBe(15);
  });

  test("Cask No. 1.285 Hello World", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Cask No. 1.285 Hello World",
    });
    expect(name).toMatchInlineSnapshot(`"Cask No. 1.285 Hello World"`);
    expect(statedAge).toBeNull();
  });

  test("Hello World Cask No. 1.285", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Hello World Cask No. 1.285",
    });
    expect(name).toMatchInlineSnapshot(`"Hello World Cask No. 1.285"`);
    expect(statedAge).toBeNull();
  });

  test("Traigh Bhan 19-year-old Scotch Batch No. 5", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Traigh Bhan 19-year-old Scotch Batch No. 5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch (Batch No. 5)", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Traigh Bhan 19-year-old Scotch (Batch No. 5)",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch #5", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Traigh Bhan 19-year-old Scotch Batch #5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch 5", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Traigh Bhan 19-year-old Scotch Batch 5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch A", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Traigh Bhan 19-year-old Scotch Batch A",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch, Batch A", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Traigh Bhan 19-year-old Scotch, Batch A",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Batch A", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Batch A",
    });
    expect(name).toMatchInlineSnapshot(`"Batch A"`);
    expect(statedAge).toBeNull();
  });

  test("Small Batch Bourbon", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Small Batch Bourbon",
    });
    expect(name).toMatchInlineSnapshot(`"Small Batch Bourbon"`);
    expect(statedAge).toBeNull();
  });

  test("Old Synergies #12", async () => {
    const { name, statedAge } = normalizeBottleName({
      name: "Old Synergies #12",
    });
    expect(name).toMatchInlineSnapshot(`"Old Synergies #12"`);
    expect(statedAge).toBeNull();
  });

  test("1993 Vintage", async () => {
    const rv = normalizeBottleName({
      name: "1993 Vintage",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "name": "1993 Vintage",
        "statedAge": null,
        "vintageYear": 1993,
      }
    `);
  });

  test("1993 Release", async () => {
    const rv = normalizeBottleName({
      name: "1993 Release",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "name": "1993 Release",
        "statedAge": null,
        "vintageYear": 1993,
      }
    `);
  });

  describe("isFullName = false", () => {
    test("Black Art 1992 Edition 9.1 29-year-old Single Malt", async () => {
      const { name, statedAge } = normalizeBottleName({
        name: "Black Art 1992 Edition 9.1 29-year-old Single Malt",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(
        `"29-year-old Black Art 1992 Edition 9.1 Single Malt"`,
      );
      expect(statedAge).toEqual(29);
    });

    test("Cask No. 1.285 Hello World", async () => {
      const { name, statedAge } = normalizeBottleName({
        name: "Cask No. 1.285 Hello World",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(`"1.285 Hello World"`);
      expect(statedAge).toBeNull();
    });

    test("Batch #1, 10-year-old", async () => {
      const { name, statedAge } = normalizeBottleName({
        name: "Batch #1, 10-year-old",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(`"10-year-old (Batch 1)"`);
      expect(statedAge).toEqual(10);
    });
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

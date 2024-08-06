import { normalizeBottle, normalizeVolume } from "./normalize";

describe("normalizeBottle", () => {
  test("just the age", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "10",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old"`);
    expect(statedAge).toBe(10);
  });

  test("age suffix", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 10",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10-year-old"`);
    expect(statedAge).toBe(10);
  });

  test("age suffix not age", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 10",
      statedAge: null,
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10"`);
    expect(statedAge).toBeNull();
  });

  test("age prefix", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "10 Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("age prefix not age", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "10 Wood",
      statedAge: null,
    });
    expect(name).toMatchInlineSnapshot(`"10 Wood"`);
    expect(statedAge).toBeNull();
  });

  test("casing", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "10-YEAR-OLD Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("plural to singular", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "10-years-old Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("spacing", async () => {
    let { name, statedAge } = normalizeBottle({
      name: "10 years old Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);

    ({ name, statedAge } = normalizeBottle({
      name: "10 year old Wood",
      statedAge: 10,
    }));
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("12", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "10",
    });
    expect(name).toMatchInlineSnapshot(`"10"`);
    expect(statedAge).toBeNull();
  });

  test("Name 12yr", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 12yr",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12yr.", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 12yr.",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12yrs", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 12yrs",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12 year", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 12 year",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12 year thing", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious 12 Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(statedAge).toBe(12);
  });

  test("Name twelve year thing", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious twelve Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(statedAge).toBe(12);
  });

  test("Name ten year thing", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious ten Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10-year-old thing"`);
    expect(statedAge).toBe(10);
  });

  test("Name fifteen year thing", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Delicious fifteen Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 15-year-old thing"`);
    expect(statedAge).toBe(15);
  });

  test("Cask No. 1.285 Hello World", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Cask No. 1.285 Hello World",
    });
    expect(name).toMatchInlineSnapshot(`"Cask No. 1.285 Hello World"`);
    expect(statedAge).toBeNull();
  });

  test("Hello World Cask No. 1.285", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Hello World Cask No. 1.285",
    });
    expect(name).toMatchInlineSnapshot(`"Hello World Cask No. 1.285"`);
    expect(statedAge).toBeNull();
  });

  test("Traigh Bhan 19-year-old Scotch Batch No. 5", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Traigh Bhan 19-year-old Scotch Batch No. 5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch (Batch No. 5)", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Traigh Bhan 19-year-old Scotch (Batch No. 5)",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch #5", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Traigh Bhan 19-year-old Scotch Batch #5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch 5", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Traigh Bhan 19-year-old Scotch Batch 5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch A", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Traigh Bhan 19-year-old Scotch Batch A",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch, Batch A", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Traigh Bhan 19-year-old Scotch, Batch A",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Batch A", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Batch A",
    });
    expect(name).toMatchInlineSnapshot(`"Batch A"`);
    expect(statedAge).toBeNull();
  });

  test("Booker's Springfield Batch Kentucky Straight Bourbon Whiskey", async () => {
    const rv = normalizeBottle({
      name: "Booker's Springfield Batch Kentucky Straight Bourbon Whiskey",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Booker's Springfield Batch Kentucky Straight Bourbon Whiskey",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Small Batch Bourbon", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Small Batch Bourbon",
    });
    expect(name).toMatchInlineSnapshot(`"Small Batch Bourbon"`);
    expect(statedAge).toBeNull();
  });

  test("Redbreast Small Batch Cask Strength (Batch A)", async () => {
    const rv = normalizeBottle({
      name: "Redbreast Small Batch Cask Strength (Batch A)",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": true,
        "name": "Redbreast Small Batch Cask Strength (Batch A)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Old Synergies #12", async () => {
    const { name, statedAge } = normalizeBottle({
      name: "Old Synergies #12",
    });
    expect(name).toMatchInlineSnapshot(`"Old Synergies #12"`);
    expect(statedAge).toBeNull();
  });

  test("1993 Vintage", async () => {
    const rv = normalizeBottle({
      name: "1993 Vintage",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "1993 Vintage",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": 1993,
      }
    `);
  });

  test("1993 Release", async () => {
    const rv = normalizeBottle({
      name: "1993 Release",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "1993 Release",
        "releaseYear": 1993,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Invalid Vintage", async () => {
    const rv = normalizeBottle({
      name: "Invalid Vintage",
      statedAge: 23,
      vintageYear: 2013,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Invalid Vintage",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 23,
        "vintageYear": null,
      }
    `);
  });

  test("Invalid Release due to Vintage", async () => {
    const rv = normalizeBottle({
      name: "Invalid Release",
      vintageYear: 2013,
      releaseYear: 2013,
      statedAge: 10,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Invalid Release",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 10,
        "vintageYear": 2013,
      }
    `);
  });

  test("Invalid Release and Vintage", async () => {
    const rv = normalizeBottle({
      name: "Invalid Release",
      vintageYear: 2013,
      releaseYear: 2013,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Invalid Release",
        "releaseYear": 2013,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("synergies (1993 Vintage) (2012 Release)", async () => {
    const rv = normalizeBottle({
      name: "synergies (1993 Vintage) (2012 Release)",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "synergies (1993 Vintage)",
        "releaseYear": 2012,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": 1993,
      }
    `);
  });

  test("13-year-old Bottled in Bond (Batch VVS 2024)", async () => {
    const rv = normalizeBottle({
      name: "13-year-old Bottled in Bond (Batch VVS 2024)",
      releaseYear: 2024,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "13-year-old Bottled in Bond (Batch VVS 2024)",
        "releaseYear": 2024,
        "singleCask": null,
        "statedAge": 13,
        "vintageYear": null,
      }
    `);
  });

  test("(distilled at Inchgower), 26-year-old old, 1976 vintage", async () => {
    const rv = normalizeBottle({
      name: "(distilled at Inchgower), 26-year-old old, 1976 vintage",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "26-year-old old, 1976 vintage (distilled at Inchgower)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 26,
        "vintageYear": 1976,
      }
    `);
  });

  test("(Distilled at Ardbeg) 1990, 8-year-old", async () => {
    const rv = normalizeBottle({
      name: "(Distilled at Ardbeg) 1990, 8-year-old",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "1990, 8-year-old (Distilled at Ardbeg)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 8,
        "vintageYear": null,
      }
    `);
  });

  test("Kentucky Owl® Batch #12 Kentucky Straight Bourbon Whiskey", async () => {
    const rv = normalizeBottle({
      name: "Kentucky Owl® Batch #12 Kentucky Straight Bourbon Whiskey",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Kentucky Owl Kentucky Straight Bourbon Whiskey (Batch 12)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test('Whiskey JYPSI ™ Legacy Batch 001, "The Journey"', async () => {
    const rv = normalizeBottle({
      name: 'Whiskey JYPSI ™ Legacy Batch 001, "The Journey"',
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Whiskey JYPSI Legacy "The Journey" (Batch 001)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  describe("isFullName = false", () => {
    test("Black Art 1992 Edition 9.1 29-year-old Single Malt", async () => {
      const { name, statedAge } = normalizeBottle({
        name: "Black Art 1992 Edition 9.1 29-year-old Single Malt",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(
        `"Black Art 1992 Edition 9.1 29-year-old Single Malt"`,
      );
      expect(statedAge).toEqual(29);
    });

    test("Wolves Spring Run, Batch 2", async () => {
      const rv = normalizeBottle({
        name: "Spring Run, Batch 2",
        isFullName: false,
      });
      expect(rv).toMatchInlineSnapshot(`
        {
          "caskStrength": null,
          "name": "Spring Run (Batch 2)",
          "releaseYear": null,
          "singleCask": null,
          "statedAge": null,
          "vintageYear": null,
        }
      `);
    });

    test("Cask No. 1.285 Hello World", async () => {
      const { name, statedAge } = normalizeBottle({
        name: "Cask No. 1.285 Hello World",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(`"1.285 Hello World"`);
      expect(statedAge).toBeNull();
    });

    test("Batch #1, 10-year-old", async () => {
      const { name, statedAge } = normalizeBottle({
        name: "Batch #1, 10-year-old",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(`"10-year-old (Batch 1)"`);
      expect(statedAge).toEqual(10);
    });
  });

  test("Single Cask Rye Batch A", async () => {
    const rv = normalizeBottle({
      name: "Single Cask Rye Batch A",
      isFullName: false,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Single Cask Rye (Batch A)",
        "releaseYear": null,
        "singleCask": true,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Barrel Strength Bourbon", async () => {
    const rv = normalizeBottle({
      name: "Barrel Strength Bourbon",
      isFullName: false,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": true,
        "name": "Barrel Strength Bourbon",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
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

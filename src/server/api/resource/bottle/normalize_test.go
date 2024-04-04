package bottle_test

import (
	"peated/api/resource/bottle"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeBottleName_JustAge(t *testing.T) {
	var age uint = 10
	result := bottle.NormalizeBottleName("10", &age)
	assert.Equal(t, "10-year-old", result)
}

// describe("normalizeBottleName", () => {
//   test("just the age", async () => {
//     const rv = normalizeBottleName("10", 10);
//     expect(rv).toBe("10-year-old");
//   });

//   test("age suffix", async () => {
//     const rv = normalizeBottleName("Delicious 10", 10);
//     expect(rv).toBe("Delicious 10-year-old");
//   });

//   test("age prefix", async () => {
//     const rv = normalizeBottleName("10 Wood", 10);
//     expect(rv).toBe("10-year-old Wood");
//   });

//   test("casing", async () => {
//     const rv = normalizeBottleName("10-YEAR-OLD Wood", 10);
//     expect(rv).toBe("10-year-old Wood");
//   });

//   test("plural to singular", async () => {
//     const rv = normalizeBottleName("10-years-old Wood", 10);
//     expect(rv).toBe("10-year-old Wood");
//   });

//   test("spacing", async () => {
//     const rv = normalizeBottleName("10 years old Wood", 10);
//     expect(rv).toBe("10-year-old Wood");

//     const rv2 = normalizeBottleName("10 year old Wood", 10);
//     expect(rv2).toBe("10-year-old Wood");
//   });

//   test("12", async () => {
//     const rv = normalizeBottleName("10");
//     expect(rv).toBe("10");
//   });

//   test("Name 12yr", async () => {
//     const rv = normalizeBottleName("Delicious 12yr");
//     expect(rv).toBe("Delicious 12-year-old");
//   });

//   test("Name 12yr.", async () => {
//     const rv = normalizeBottleName("Delicious 12yr.");
//     expect(rv).toBe("Delicious 12-year-old");
//   });

//   test("Name 12yrs", async () => {
//     const rv = normalizeBottleName("Delicious 12yrs");
//     expect(rv).toBe("Delicious 12-year-old");
//   });

//   test("Name 12 year", async () => {
//     const rv = normalizeBottleName("Delicious 12 year");
//     expect(rv).toBe("Delicious 12-year-old");
//   });

//   test("Name 12 year thing", async () => {
//     const rv = normalizeBottleName("Delicious 12 Year thing");
//     expect(rv).toBe("Delicious 12-year-old thing");
//   });

//   test("Cask No. 1.285 Hello World", async () => {
//     const rv = normalizeBottleName("Cask No. 1.285 Hello World");
//     expect(rv).toBe("1.285 Hello World");
//   });
// });

// describe("normalizeVolume", () => {
//   test("750ml", async () => {
//     const rv = normalizeVolume("750ml");
//     expect(rv).toBe(750);
//   });
//   test("1.75L", async () => {
//     const rv = normalizeVolume("1.75L");
//     expect(rv).toBe(1750);
//   });
//   test("invalid", async () => {
//     const rv = normalizeVolume("1.75");
//     expect(rv).toBe(null);
//   });
// });

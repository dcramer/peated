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

func TestNormalizeBottleName_AgeSuffix(t *testing.T) {
	var age uint = 10
	result := bottle.NormalizeBottleName("Delicious 10", &age)
	assert.Equal(t, "Delicious 10-year-old", result)
}

func TestNormalizeBottleName_AgePrefix(t *testing.T) {
	var age uint = 10
	result := bottle.NormalizeBottleName("10 Wood", &age)
	assert.Equal(t, "10-year-old Wood", result)
}

func TestNormalizeBottleName_Casing(t *testing.T) {
	var age uint = 10
	result := bottle.NormalizeBottleName("10-YEAR-OLD Wood", &age)
	assert.Equal(t, "10-year-old Wood", result)
}

func TestNormalizeBottleName_PluralToSingular(t *testing.T) {
	var age uint = 10
	result := bottle.NormalizeBottleName("10-years-old Wood", &age)
	assert.Equal(t, "10-year-old Wood", result)
}

func TestNormalizeBottleName_Spacing(t *testing.T) {
	var age uint = 10
	result := bottle.NormalizeBottleName("10 years old Wood", &age)
	assert.Equal(t, "10-year-old Wood", result)

	result = bottle.NormalizeBottleName("10 year old Wood", &age)
	assert.Equal(t, "10-year-old Wood", result)
}

func TestNormalizeBottleName_NumberWithoutAge(t *testing.T) {
	result := bottle.NormalizeBottleName("10", nil)
	assert.Equal(t, "10", result)
}

func TestNormalizeBottleName_YearSuffix(t *testing.T) {
	result := bottle.NormalizeBottleName("Delicious 12yr", nil)
	assert.Equal(t, "Delicious 12-year-old", result)

	result = bottle.NormalizeBottleName("Delicious 12yr.", nil)
	assert.Equal(t, "Delicious 12-year-old", result)

	result = bottle.NormalizeBottleName("Delicious 12yrs", nil)
	assert.Equal(t, "Delicious 12-year-old", result)

	result = bottle.NormalizeBottleName("Delicious 12 year", nil)
	assert.Equal(t, "Delicious 12-year-old", result)
}

func TestNormalizeBottleName_YearContained(t *testing.T) {
	result := bottle.NormalizeBottleName("Delicious 12 year thing", nil)
	assert.Equal(t, "Delicious 12-year-old Thing", result)
}

func TestNormalizeBottleName_CaskNoPrefix(t *testing.T) {
	result := bottle.NormalizeBottleName("Cask No. 1.285 Hello World", nil)
	assert.Equal(t, "1.285 Hello World", result)
}

func TestNormalizeBottleName_AgeMidName(t *testing.T) {
	var age uint = 12
	result := bottle.NormalizeBottleName("Delicious 12 thing", &age)
	assert.Equal(t, "Delicious 12-year-old Thing", result)

	result = bottle.NormalizeBottleName("Delicious 12 thing", nil)
	assert.Equal(t, "Delicious 12 Thing", result)

}

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

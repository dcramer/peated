package bottle_test

import (
	"peated/api/resource/bottle"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeBottleName_JustAge(t *testing.T) {
	var age uint64 = 10
	name, ageR := bottle.NormalizeBottleName("10", &age)
	assert.Equal(t, "10-year-old", name)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_AgeSuffix(t *testing.T) {
	var age uint64 = 10
	name, ageR := bottle.NormalizeBottleName("Delicious 10", &age)
	assert.Equal(t, "Delicious 10-year-old", name)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_AgePrefix(t *testing.T) {
	var age uint64 = 10
	name, ageR := bottle.NormalizeBottleName("10 Wood", &age)
	assert.Equal(t, "10-year-old Wood", name)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_Casing(t *testing.T) {
	var age uint64 = 10
	name, ageR := bottle.NormalizeBottleName("10-YEAR-OLD Wood", &age)
	assert.Equal(t, "10-year-old Wood", name)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_PluralToSingular(t *testing.T) {
	var age uint64 = 10
	name, ageR := bottle.NormalizeBottleName("10-years-old Wood", &age)
	assert.Equal(t, "10-year-old Wood", name)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_Spacing(t *testing.T) {
	var age uint64 = 10
	name, ageR := bottle.NormalizeBottleName("10 years old Wood", &age)
	assert.Equal(t, "10-year-old Wood", name)
	assert.EqualValues(t, age, *ageR)

	name, ageR = bottle.NormalizeBottleName("10 year old Wood", &age)
	assert.Equal(t, "10-year-old Wood", name)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_NumberWithoutAge(t *testing.T) {
	name, ageR := bottle.NormalizeBottleName("10", nil)
	assert.Equal(t, "10", name)
	assert.Nil(t, ageR)
}

func TestNormalizeBottleName_YearSuffix(t *testing.T) {
	var age uint64 = 12
	name, ageR := bottle.NormalizeBottleName("Delicious 12yr", nil)
	assert.Equal(t, "Delicious 12-year-old", name)
	require.NotNil(t, ageR)
	assert.EqualValues(t, age, *ageR)

	name, ageR = bottle.NormalizeBottleName("Delicious 12yr.", nil)
	assert.Equal(t, "Delicious 12-year-old", name)
	require.NotNil(t, ageR)
	assert.EqualValues(t, age, *ageR)

	name, ageR = bottle.NormalizeBottleName("Delicious 12yrs", nil)
	assert.Equal(t, "Delicious 12-year-old", name)
	require.NotNil(t, ageR)
	assert.EqualValues(t, age, *ageR)

	name, ageR = bottle.NormalizeBottleName("Delicious 12 year", nil)
	assert.Equal(t, "Delicious 12-year-old", name)
	require.NotNil(t, ageR)
	assert.EqualValues(t, age, *ageR)
}

func TestNormalizeBottleName_YearContained(t *testing.T) {
	var age uint64 = 12
	name, ageR := bottle.NormalizeBottleName("Delicious 12 year thing", nil)
	assert.Equal(t, "Delicious 12-year-old Thing", name)
	assert.Equal(t, age, *ageR)
}

func TestNormalizeBottleName_CaskNoPrefix(t *testing.T) {
	name, ageR := bottle.NormalizeBottleName("Cask No. 1.285 Hello World", nil)
	assert.Equal(t, "1.285 Hello World", name)
	assert.Nil(t, ageR)
}

func TestNormalizeBottleName_AgeMidName(t *testing.T) {
	var age uint64 = 12
	name, ageR := bottle.NormalizeBottleName("Delicious 12 thing", &age)
	assert.Equal(t, "Delicious 12-year-old Thing", name)
	assert.EqualValues(t, age, *ageR)

	name, ageR = bottle.NormalizeBottleName("Delicious 12 thing", nil)
	assert.Equal(t, "Delicious 12 Thing", name)
	assert.Nil(t, ageR)

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

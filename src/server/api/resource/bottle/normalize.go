package bottle

import (
	"fmt"
	"peated/database/model"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/go-errors/errors"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

const ageSuffix = "-year-old"

func ToTitleCase(value string) string {
	caser := cases.Title(language.English)
	return caser.String(value)
}

func CategoryName(name string) string {
	name = strings.ReplaceAll(name, "_", "")

	name = ToTitleCase(name)

	return name
}

func NormalizeCategory(name string) (string, error) {
	nameLower := strings.ToLower(name)
	if slices.Contains(model.CategoryNames, nameLower) {
		return nameLower, nil
	}
	if strings.HasPrefix(name, "single malt") || strings.HasSuffix(nameLower, "single malt") {
		return model.CategorySingleMalt, nil
	}

	for _, c := range model.CategoryNames {
		if strings.HasPrefix(name, strings.ToLower(CategoryName(c))) {
			return c, nil
		}
	}

	return "", errors.Errorf("invalid category: %s", name)
}

func NormalizeBottleName(name string, statedAge *uint64) (string, *uint64) {
	name = NormalizeString(name)

	name = ToTitleCase(name)

	// this is primarily targeting Scotch Malt Whiskey Society bottles
	name = strings.TrimPrefix(name, "Cask No. ")

	// remove newlines
	name = strings.ReplaceAll(name, "\n", " ")

	// remove consecutive whitespace
	whitespaceRe := regexp.MustCompile(`\s{2,}`)
	name = whitespaceRe.ReplaceAllString(name, " ")

	// "years old" type patterns
	yearsOldRe := regexp.MustCompile(`(?i)(\d+)[\s-]?years?(?:[\s-]old)?($|\s)`)
	name = yearsOldRe.ReplaceAllString(name, "$1"+ageSuffix+"$2")

	// "yrs old"
	yrsOldRe := regexp.MustCompile(`(?i)(\d+)[\s-]?yrs?\.?(?:[\s-]old)?($|\s)`)
	name = yrsOldRe.ReplaceAllString(name, "$1"+ageSuffix+"$2")

	if statedAge == nil {
		statedAgeRe := regexp.MustCompile(`(\d+)-year-old`)
		statedAgeMatch := statedAgeRe.FindStringSubmatch(name)
		if len(statedAgeMatch) > 1 {
			statedAgeResult, err := strconv.ParseUint(statedAgeMatch[1], 10, 64)
			if err == nil && statedAgeResult != 0 {
				statedAge = &statedAgeResult
			}
		}
	}

	if statedAge == nil {
		return name, statedAge
	}
	ageAsStr := strconv.FormatUint(uint64(*statedAge), 10)

	if name == ageAsStr {
		return fmt.Sprintf("%s%s", ageAsStr, ageSuffix), statedAge
	}

	if strings.HasPrefix(name, fmt.Sprintf("%s ", ageAsStr)) {
		prefixRe := regexp.MustCompile(`^` + regexp.QuoteMeta(ageAsStr))
		name = prefixRe.ReplaceAllString(name, ageAsStr+ageSuffix)
	}

	if strings.HasSuffix(name, fmt.Sprintf(" %s", ageAsStr)) {
		prefixRe := regexp.MustCompile(regexp.QuoteMeta(ageAsStr) + `$`)
		name = prefixRe.ReplaceAllString(name, ageAsStr+ageSuffix)
	}

	ageRe := regexp.MustCompile(`\s` + regexp.QuoteMeta(ageAsStr) + `\s`)
	name = ageRe.ReplaceAllString(name, " "+ageAsStr+ageSuffix+" ")

	return name, statedAge
}

func NormalizeString(value string) string {
	smartAposRe := regexp.MustCompile(`[\x{2018}\x{2019}]`)
	value = smartAposRe.ReplaceAllString(value, "'")

	smartQuotesRe := regexp.MustCompile(`[\x{201C}\x{201D}]`)
	value = smartQuotesRe.ReplaceAllString(value, "\"")

	return value
}

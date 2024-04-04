package bottle

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const ageSuffix = "-year-old"

func NormalizeBottleName(name string, statedAge *uint) string {
	name = NormalizeString(name)

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
		return name
	}
	ageAsStr := strconv.FormatUint(uint64(*statedAge), 10)

	if statedAge != nil && name == ageAsStr {
		return fmt.Sprintf("%s%s", ageAsStr, ageSuffix)
	}

	if strings.HasPrefix(name, fmt.Sprintf("%s ", ageAsStr)) {
		prefixRe := regexp.MustCompile(`^` + regexp.QuoteMeta(ageAsStr))
		name = prefixRe.ReplaceAllString(name, ageAsStr+ageSuffix)
	}

	if strings.HasSuffix(name, fmt.Sprintf(" %s", ageAsStr)) {
		prefixRe := regexp.MustCompile(regexp.QuoteMeta(ageAsStr) + `$`)
		name = prefixRe.ReplaceAllString(name, ageAsStr+ageSuffix)
	}

	// return normalizeString(name.replace(` ${age} `, ` ${age}${ageSuffix} `));

	return name
}

func NormalizeString(value string) string {
	return value
}

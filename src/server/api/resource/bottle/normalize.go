package bottle

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const ageSuffix = "-year-old"

func NormalizeBottleName(name string, statedAge *uint) string {
	if statedAge != nil && name == strconv.FormatUint(uint64(*statedAge), 10) {
		return fmt.Sprintf("%s%s", strconv.FormatUint(uint64(*statedAge), 10), ageSuffix)
	}

	// remove newlines
	name = strings.ReplaceAll(name, "\n", " ")

	// remove consecutive whitespace
	whitespaceRe := regexp.MustCompile(`\s{2,}`)
	name = whitespaceRe.ReplaceAllString(name, " ")

	// "years old" type patterns
	yearsOldRe := regexp.MustCompile(`(?i)(\d+)[\s-]?years?(?:[\s-]old)?($|\s)`)
	name = yearsOldRe.ReplaceAllString(name, "$1"+ageSuffix+"$2")

	// // abberviated yr
	// name = name
	//   .replace(/(\d+)\s?yrs?\.?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
	//   .replace(/(\d+)\s?yrs?\.?($|\s)/i, `$1${ageSuffix}$2`);

	// if (name.startsWith(`${age} `)) {
	//   name = name.replace(`${age} `, `${age}${ageSuffix} `);
	// }
	// if (name.endsWith(` ${age}`)) {
	//   name = `${name}${ageSuffix}`;
	// }

	// // this is primarily targeting Scotch Malt Whiskey Society bottles
	// if (name.startsWith("Cask No. ")) {
	//   name = name.substring(9);
	// }

	// return normalizeString(name.replace(` ${age} `, ` ${age}${ageSuffix} `));

	return NormalizeString(name)
}

func NormalizeString(value string) string {
	return value
}

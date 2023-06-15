const ageSuffix = "-year-old";

export const normalizeBottleName = (
  name: string,
  age?: number | null,
): string => {
  // try to ease UX and normalize common name components
  if (age && name == `${age}`) return `${age}${ageSuffix}`;

  // "years old" type patterns
  name = name
    .replace(/(\d+)[\s-]?years?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d+)[\s-]?years?($|\s)/i, `$1${ageSuffix}$2`);

  // abberviated yr
  name = name
    .replace(/(\d+)\s?yrs?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d+)\s?yrs?($|\s)/i, `$1${ageSuffix}$2`);

  if (name.indexOf(`${age} `) === 0) {
    name = name.replace(`${age} `, `${age}${ageSuffix} `);
  }
  if (name.endsWith(` ${age}`)) {
    name = `${name}${ageSuffix}`;
  }
  return name.replace(` ${age} `, ` ${age}${ageSuffix} `);
};

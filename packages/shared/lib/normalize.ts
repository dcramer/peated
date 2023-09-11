const ageSuffix = "-year-old";

export const normalizeBottleName = (
  name: string,
  age?: number | null,
): string => {
  // try to ease UX and normalize common name components
  if (age && name == `${age}`) return `${age}${ageSuffix}`;

  name = name.replace(/\n/, " ").replace(/\s{2,}/, " ");

  // "years old" type patterns
  name = name
    .replace(/(\d+)[\s-]?years?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d+)[\s-]?years?($|\s)/i, `$1${ageSuffix}$2`);

  // abberviated yr
  name = name
    .replace(/(\d+)\s?yrs?\.?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d+)\s?yrs?\.?($|\s)/i, `$1${ageSuffix}$2`);

  if (name.indexOf(`${age} `) === 0) {
    name = name.replace(`${age} `, `${age}${ageSuffix} `);
  }
  if (name.endsWith(` ${age}`)) {
    name = `${name}${ageSuffix}`;
  }
  return name.replace(` ${age} `, ` ${age}${ageSuffix} `);
};

/* Normalize volume to milliliters */
export function normalizeVolume(volume: string): number | null {
  const match = volume.match(/^\s*([0-9.]+)\s?(ml|l)\s*(\sbottle)?$/i);
  if (!match) return null;

  const [amount, measure] = match.slice(1, 3);

  switch (measure.toLowerCase()) {
    case "l":
      return parseFloat(amount) * 1000;
    case "ml":
      return parseInt(amount, 10);
    default:
      return null;
  }
}

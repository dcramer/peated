const MONTHS = new Map(
  [
    ["jan", "january"],
    ["feb", "february"],
    ["mar", "march"],
    ["apr", "april"],
    ["may", "may"],
    ["jun", "june"],
    ["jul", "july"],
    ["aug", "august"],
    ["sep", "sept", "september"],
    ["oct", "october"],
    ["nov", "november"],
    ["dec", "december"],
  ].flatMap((names, month) => names.map((name) => [name, month] as const)),
);

function fromParts(year: number, month: number, day: number): Date | null {
  if (![year, month, day].every(Number.isInteger)) return null;

  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
    ? date
    : null;
}

/** Parses common publisher date values without guessing a missing year. */
export function parseDate(
  value: string,
  { fallbackYear }: { fallbackYear?: number } = {},
): Date | null {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  if (!normalized) return null;

  const isoDate =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?<time>T.*)?$/u.exec(
      normalized,
    );
  if (isoDate?.groups) {
    const date = fromParts(
      Number(isoDate.groups.year),
      Number(isoDate.groups.month) - 1,
      Number(isoDate.groups.day),
    );
    if (!date) return null;
    if (!isoDate.groups.time) return date;

    const timestamp = new Date(
      /(?:Z|[+-]\d{2}:?\d{2})$/iu.test(normalized)
        ? normalized
        : `${normalized}Z`,
    );
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  }

  const dayFirst =
    /^(?<day>\d{1,2})(?:st|nd|rd|th)?\s+(?<month>[A-Za-z]+)(?:,?\s+(?<year>\d{4}))?$/u.exec(
      normalized,
    );
  if (dayFirst?.groups) {
    const month = MONTHS.get(dayFirst.groups.month.toLocaleLowerCase("en"));
    const year = Number(dayFirst.groups.year ?? fallbackYear);
    return month === undefined
      ? null
      : fromParts(year, month, Number(dayFirst.groups.day));
  }

  const monthFirst =
    /^(?<month>[A-Za-z]+)\s+(?<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+)(?<year>\d{4})$/u.exec(
      normalized,
    );
  if (monthFirst?.groups) {
    const month = MONTHS.get(monthFirst.groups.month.toLocaleLowerCase("en"));
    return month === undefined
      ? null
      : fromParts(
          Number(monthFirst.groups.year),
          month,
          Number(monthFirst.groups.day),
        );
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

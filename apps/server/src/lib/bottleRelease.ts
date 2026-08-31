export type ReleaseDateParts = {
  releaseYear: number | null;
  releaseMonth: number | null;
  releaseDay: number | null;
};

export function isValidReleaseDate({
  releaseYear,
  releaseMonth,
  releaseDay,
}: ReleaseDateParts): boolean {
  if (releaseMonth === null) {
    return releaseDay === null;
  }
  if (releaseYear === null || releaseMonth < 1 || releaseMonth > 12) {
    return false;
  }
  if (releaseDay === null) {
    return true;
  }

  const date = new Date(Date.UTC(releaseYear, releaseMonth - 1, releaseDay));
  return (
    date.getUTCFullYear() === releaseYear &&
    date.getUTCMonth() === releaseMonth - 1 &&
    date.getUTCDate() === releaseDay
  );
}

export function parseExactReleaseDate(value: string): ReleaseDateParts | null {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u.exec(value);
  if (!match?.groups) return null;

  const parts = {
    releaseYear: Number(match.groups.year),
    releaseMonth: Number(match.groups.month),
    releaseDay: Number(match.groups.day),
  };
  return isValidReleaseDate(parts) ? parts : null;
}

const releaseMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const exactReleaseDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function formatReleaseDate(parts: ReleaseDateParts): string | null {
  if (parts.releaseYear === null || !isValidReleaseDate(parts)) return null;
  if (parts.releaseMonth === null) return String(parts.releaseYear);

  const date = new Date(
    Date.UTC(parts.releaseYear, parts.releaseMonth - 1, parts.releaseDay ?? 1),
  );
  return parts.releaseDay === null
    ? releaseMonthFormatter.format(date)
    : exactReleaseDateFormatter.format(date);
}

export function releaseYearFromDate(releaseDate: string): number {
  return Number(releaseDate.slice(0, 4));
}

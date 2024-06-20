import type { Option } from "./types";

export function filterDupes<T extends Option>(
  firstList: T[],
  ...moreLists: T[][]
) {
  const results: T[] = [...firstList];
  const matches = new Set(firstList.map((i) => `${i.id || i.name}`));

  moreLists.forEach((options) => {
    options.forEach((i) => {
      if (!matches.has(`${i.id || i.name}`)) {
        results.push(i);
        matches.add(`${i.id || i.name}`);
      }
    });
  });
  return results;
}

import type { Option } from "./types";

export function filterDupes(firstList: Option[], ...moreLists: Option[][]) {
  const results: Option[] = [...firstList];
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

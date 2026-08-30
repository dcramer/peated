import { allScenarioIds, SCENARIOS } from "./scenarios/index.mjs";

/** Keep the automatic screenshot set small enough to review. */
export const MAX_SCENARIOS = 4;

/** Pick pages from the changed files. An empty result means there is nothing to capture. */
export function selectScenarioIds(
  changedFiles,
  { all = false, max = MAX_SCENARIOS } = {},
) {
  if (all) return allScenarioIds();

  const selected = new Set();
  for (const changedFile of changedFiles) {
    const normalized = changedFile.replaceAll("\\", "/");
    for (const scenario of SCENARIOS) {
      if (scenario.shouldRunFor(normalized)) selected.add(scenario.id);
    }
  }

  return allScenarioIds()
    .filter((id) => selected.has(id))
    .slice(0, max);
}

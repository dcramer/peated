import { addTastingScenario } from "./add-tasting.mjs";
import { bottleDetailScenario } from "./bottle-detail.mjs";
import { bottlerDetailScenario } from "./bottler-detail.mjs";
import { brandDetailScenario } from "./brand-detail.mjs";
import { distilleryDetailScenario } from "./distillery-detail.mjs";
import { homeScenario } from "./home.mjs";
import { loginScenario } from "./login.mjs";
import { memberProfileScenario } from "./member-profile.mjs";

export const SCENARIOS = [
  homeScenario,
  bottleDetailScenario,
  memberProfileScenario,
  addTastingScenario,
  loginScenario,
  brandDetailScenario,
  distilleryDetailScenario,
  bottlerDetailScenario,
];

const scenarioById = new Map(
  SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

export function allScenarioIds() {
  return SCENARIOS.map((scenario) => scenario.id);
}

export function getScenarios(ids) {
  return ids.map((id) => {
    const scenario = scenarioById.get(id);
    if (!scenario) throw new Error(`Unknown screenshot scenario: ${id}`);
    return scenario;
  });
}

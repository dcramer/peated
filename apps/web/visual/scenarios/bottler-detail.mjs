import { testBottler } from "../../e2e/rpc-fixtures.mjs";
import { isEntityPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const bottlerDetailScenario = {
  heading: testBottler.name,
  id: "bottler-detail",
  label: "Bottler detail",
  path: `/bottlers/${testBottler.id}`,
  shouldRunFor: (filePath) =>
    isEntityPageChange(filePath) || isTestDataChange(filePath),
  viewports: [DESKTOP, MOBILE],
};

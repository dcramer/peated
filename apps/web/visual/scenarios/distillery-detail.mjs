import { testOwnedEntity } from "../../e2e/rpc-fixtures.mjs";
import { isEntityPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const distilleryDetailScenario = {
  heading: testOwnedEntity.name,
  id: "distillery-detail",
  label: "Distillery detail",
  path: `/distillers/${testOwnedEntity.id}`,
  shouldRunFor: (filePath) =>
    isEntityPageChange(filePath) || isTestDataChange(filePath),
  viewports: [DESKTOP, MOBILE],
};

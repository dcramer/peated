import { testBrand } from "../../e2e/rpc-fixtures.mjs";
import { isEntityPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const brandDetailScenario = {
  heading: testBrand.name,
  id: "brand-detail",
  label: "Brand detail",
  path: `/brands/${testBrand.id}`,
  shouldRunFor: (filePath) =>
    isEntityPageChange(filePath) || isTestDataChange(filePath),
  viewports: [DESKTOP, MOBILE],
};

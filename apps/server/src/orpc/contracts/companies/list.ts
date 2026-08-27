import { createEntityKindListContract } from "@peated/server/orpc/contracts/entityKinds/list";

export default createEntityKindListContract({
  path: "/companies",
  summary: "List companies",
  description: "Find entities whose primary kind is Company",
  operationId: "listCompanies",
});

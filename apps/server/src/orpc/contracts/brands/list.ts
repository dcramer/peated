import { createEntityKindListContract } from "@peated/server/orpc/contracts/entityKinds/list";

export default createEntityKindListContract({
  path: "/brands",
  summary: "List brands",
  description: "Find entities whose primary kind is Brand",
  operationId: "listBrands",
});

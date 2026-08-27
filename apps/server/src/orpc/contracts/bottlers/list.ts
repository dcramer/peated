import { createEntityKindListContract } from "@peated/server/orpc/contracts/entityKinds/list";

export default createEntityKindListContract({
  path: "/bottlers",
  summary: "List bottlers",
  description: "Find entities whose primary kind is Bottler",
  operationId: "listBottlers",
});

import { createEntityKindListContract } from "@peated/server/orpc/contracts/entityKinds/list";

export default createEntityKindListContract({
  path: "/distilleries",
  summary: "List distilleries",
  description: "Find entities whose primary kind is Distillery",
  operationId: "listDistilleries",
});

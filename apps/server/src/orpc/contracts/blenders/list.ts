import { createEntityKindListContract } from "@peated/server/orpc/contracts/entityKinds/list";

export default createEntityKindListContract({
  path: "/blenders",
  summary: "List blenders",
  description: "Find entities whose primary kind is Blender",
  operationId: "listBlenders",
});

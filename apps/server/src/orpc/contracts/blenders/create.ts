import { entityKindCreateContract } from "../entityKinds/create";

export default entityKindCreateContract({
  operationId: "createBlender",
  path: "/blenders",
  summary: "Create a blender",
});

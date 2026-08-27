import { entityKindCreateContract } from "../entityKinds/create";

export default entityKindCreateContract({
  operationId: "createDistillery",
  path: "/distilleries",
  summary: "Create a distillery",
});

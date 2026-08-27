import { entityKindCreateContract } from "../entityKinds/create";

export default entityKindCreateContract({
  operationId: "createBottler",
  path: "/bottlers",
  summary: "Create a bottler",
});

import { entityKindCreateContract } from "../entityKinds/create";

export default entityKindCreateContract({
  operationId: "createBrand",
  path: "/brands",
  summary: "Create a brand",
});

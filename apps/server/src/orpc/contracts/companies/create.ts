import { entityKindCreateContract } from "../entityKinds/create";

export default entityKindCreateContract({
  operationId: "createCompany",
  path: "/companies",
  summary: "Create a company",
});

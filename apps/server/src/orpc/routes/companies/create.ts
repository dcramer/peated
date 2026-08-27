import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/companies/create";
import {
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware/auth";
import { createEntityKind } from "@peated/server/orpc/routes/entityKinds/create";

export default implement(contract)
  .use(requireVerified)
  .use(requireTosAccepted)
  .handler(({ input, context, errors }) =>
    createEntityKind({
      currentUser: context.user,
      errors,
      input,
      kind: "company",
    }),
  );

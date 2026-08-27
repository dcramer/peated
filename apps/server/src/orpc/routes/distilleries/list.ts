import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/distilleries/list";
import { listEntityKind } from "@peated/server/orpc/routes/entityKinds/list";

export default implement(contract).handler(({ input, context, errors }) =>
  listEntityKind({
    input,
    kind: "distillery",
    currentUser: context.user,
    badRequest: (message) => {
      throw errors.BAD_REQUEST({ message });
    },
  }),
);

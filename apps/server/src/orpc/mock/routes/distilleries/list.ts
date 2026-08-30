import { mockOS } from "@peated/server/orpc/mock/implementer";
import { listEntityKind } from "@peated/server/orpc/mock/routes/entityKinds/list";

export default mockOS.distilleries.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "following" && !context.user) {
      throw errors.UNAUTHORIZED();
    }
    return listEntityKind("distillery", input, Boolean(context.user));
  },
);

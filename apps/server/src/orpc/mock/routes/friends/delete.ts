import { mockPublicUserDetailsList } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.friends.delete.handler(
  async ({ input, context, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    if (context.user.id === input.user) {
      throw errors.BAD_REQUEST({ message: "Cannot unfriend yourself." });
    }
    if (!mockPublicUserDetailsList.some((user) => user.id === input.user)) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    return { status: "none" };
  },
);

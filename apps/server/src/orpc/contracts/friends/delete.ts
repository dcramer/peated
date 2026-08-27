import { FriendStatusEnum } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "DELETE",
    path: "/friends/{user}",
    summary: "Remove friend",
    description:
      "Remove a friend relationship and cancel any pending friend requests. Requires authentication",
    operationId: "removeFriend",
  })
  .input(z.object({ user: z.coerce.number() }))
  .output(
    z.object({
      status: FriendStatusEnum,
    }),
  );

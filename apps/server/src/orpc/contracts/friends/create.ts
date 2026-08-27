import { FriendStatusEnum } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "PUT",
    path: "/friends/{user}",
    summary: "Send friend request",
    description:
      "Send a friend request to another user or accept a pending request. Creates mutual following relationship when accepted",
    operationId: "addFriend",
  })
  .input(
    z.object({
      user: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      status: FriendStatusEnum,
    }),
  );

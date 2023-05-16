import { Follow, User } from "../../db/schema";
import { serializeUser } from "./user";

export const serializeFriend = (
  follow: Follow & {
    user: User;
  },
  currentUser?: User,
) => {
  return {
    id: follow.toUserId,
    status: follow.status,
    createdAt: follow.createdAt,
    user: serializeUser(follow.user, currentUser),
  };
};

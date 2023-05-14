import { Follow, User } from "../../db/schema";
import { serializeUser } from "./user";

export const serializeFollow = (
  follow: Follow & {
    user: User;
    followsBack?: Follow | null;
  },
  currentUser?: User,
) => {
  return {
    id: follow.fromUserId,
    status: follow.status,
    createdAt: follow.createdAt,
    user: serializeUser(follow.user, currentUser),
    followsBack: follow.followsBack?.status || "none",
  };
};

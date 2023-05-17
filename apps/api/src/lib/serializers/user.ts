import config from "../../config";
import { User } from "../../db/schema";

export interface SerializedUser {
  id: number;
  displayName: string | null;
  pictureUrl: string | null;
  username: string;
  admin?: boolean;
  mod?: boolean;
  email?: string;
  createdAt?: string;
  followStatus?: "none" | "following" | "pending";
}

export const serializeUser = (
  user: User & {
    followStatus?: "none" | "following" | "pending";
  },
  currentUser?: User,
): SerializedUser => {
  const data: SerializedUser = {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    pictureUrl: user.pictureUrl
      ? `${config.URL_PREFIX}${user.pictureUrl}`
      : null,
    followStatus: user.followStatus,
  };
  if (
    currentUser &&
    (currentUser.admin || currentUser.mod || currentUser.id === user.id)
  ) {
    return {
      ...data,
      email: user.email,
      createdAt: user.email,
      admin: user.admin,
      mod: user.admin || user.mod,
    };
  }
  return data;
};

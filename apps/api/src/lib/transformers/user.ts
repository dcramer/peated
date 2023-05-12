import config from "../../config";
import { User } from "../../db/schema";

export interface SerializedUser {
  id: number;
  displayName: string | null;
  pictureUrl: string | null;
  admin?: boolean;
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
    pictureUrl: user.pictureUrl
      ? `${config.URL_PREFIX}${user.pictureUrl}`
      : null,
    followStatus: user.followStatus,
  };
  if (currentUser && (currentUser.admin || currentUser.id === user.id)) {
    return {
      ...data,
      email: user.email,
      createdAt: user.email,
      admin: user.admin,
    };
  }
  return data;
};

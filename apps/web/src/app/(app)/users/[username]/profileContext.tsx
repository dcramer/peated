"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { createContext, useContext, type ReactNode } from "react";

export type ProfileUser = Outputs["users"]["details"];

type ProfileContextValue = {
  currentUserId?: number;
  user: ProfileUser;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  children,
  currentUserId,
  user,
}: ProfileContextValue & { children: ReactNode }) {
  return (
    <ProfileContext.Provider value={{ currentUserId, user }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used within ProfileProvider");
  return { ...value, isCurrentUser: value.currentUserId === value.user.id };
}

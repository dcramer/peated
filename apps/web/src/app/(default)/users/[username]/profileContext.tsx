"use client";

import { createContext, useContext, type ReactNode } from "react";

const ProfileUserIdContext = createContext<number | null>(null);

/** Provides the current profile id to nested profile tab routes. */
export function ProfileProvider({
  userId,
  children,
}: {
  userId: number;
  children: ReactNode;
}) {
  return (
    <ProfileUserIdContext.Provider value={userId}>
      {children}
    </ProfileUserIdContext.Provider>
  );
}

/** Returns the profile id loaded by the parent profile layout. */
export function useProfileUserId() {
  const userId = useContext(ProfileUserIdContext);
  if (!userId) {
    throw new Error("useProfileUserId must be used within ProfileProvider");
  }
  return userId;
}

"use client";

import type { User } from "@peated/server/types";
import { createContext, useContext, useEffect, useState } from "react";

type Auth = {
  isLoading: boolean;
  setUser: (user: User | null) => void;
  user: User | null;
  isLoggedIn: boolean;
  /**
   * Re-reads the account from the API. Returns true after sending a member
   * whose session was rejected or suspended to sign in or the suspension
   * screen.
   */
  refreshAccount: () => Promise<boolean>;
};

const AuthContext = createContext<Auth>({
  isLoading: false,
  setUser: () => {
    throw new Error("Missing AuthProvider");
  },
  user: null,
  isLoggedIn: false,
  refreshAccount: async () => false,
});

export const AuthProvider = ({
  user,
  refreshAccount,
  children,
}: {
  user: User | null;
  refreshAccount: Auth["refreshAccount"];
  children: any;
}) => {
  const [value, setValue] = useState<User | null>(user);
  const isLoading = value?.id !== user?.id;

  useEffect(() => {
    setValue(user);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        user: value,
        setUser: setValue,
        isLoggedIn: !!value,
        refreshAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default function useAuth() {
  return useContext(AuthContext);
}

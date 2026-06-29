"use client";

import type { User } from "@peated/server/types";
import { createContext, useContext, useEffect, useState } from "react";

type Auth = {
  isLoading: boolean;
  setUser: (user: User | null) => void;
  user: User | null;
  isLoggedIn: boolean;
};

const AuthContext = createContext<Auth>({
  isLoading: false,
  setUser: () => {
    throw new Error("Missing AuthProvider");
  },
  user: null,
  isLoggedIn: false,
});

export const AuthProvider = ({
  user = null,
  children,
}: {
  user: User | null;
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default function useAuth() {
  return useContext(AuthContext);
}

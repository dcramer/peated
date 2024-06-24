"use client";

import type { User } from "@peated/server/types";
import { createContext, useContext, useEffect, useState } from "react";

type Auth = {
  setUser: (user: User | null) => void;
  user: User | null;
  isLoggedIn: boolean;
};

const AuthContext = createContext<Auth>({
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

  useEffect(() => {
    setValue(value);
  }, [value, user]);

  return (
    <AuthContext.Provider
      value={{
        user: user
          ? {
              ...user,
              ...value,
            }
          : null,
        setUser: setValue,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default function useAuth() {
  return useContext(AuthContext);
}

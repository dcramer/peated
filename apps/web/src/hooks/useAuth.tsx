import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { User } from "../types";
import useLocalStorage from "./useLocalStorage";

type AuthState = "loading" | "ready";

type Auth = {
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  state: AuthState;
  user: User | null;
};

const AuthContext = createContext<Auth>({
  login: () => {
    throw new Error("Missing AuthProvider");
  },
  logout: () => {
    throw new Error("Missing AuthProvider");
  },
  updateUser: () => {
    throw new Error("Missing AuthProvider");
  },
  state: "loading",
  user: null,
});

export const AuthProvider = ({ children }: { children: any }) => {
  const [state, setState] = useState<AuthState>("loading");

  const [user, setUser] = useLocalStorage<User | null>("user", null);
  const [accessToken, setAccessToken] = useLocalStorage<string | null>(
    "token",
    null,
  );

  // kind of gross this exists here, need a better pattern
  useEffect(() => {
    api.setAccessToken(accessToken);
  }, [accessToken]);

  // call this function when you want to authenticate the user
  const login = (user: User, accessToken: string) => {
    setAccessToken(accessToken);
    setUser(user);
    if (state === "loading") setState("ready");
  };

  const updateUser = (user: User) => {
    setUser(user);
  };

  // call this function to sign out logged in user
  const logout = () => {
    setUser(null);
    setAccessToken(null);
    if (state === "loading") setState("ready");
  };

  // validate if the user is valid
  useEffect(() => {
    (async () => {
      if (state !== "loading") return;

      if (!user || !accessToken) {
        setUser(null);
        setAccessToken(null);
      } else if (user && accessToken) {
        try {
          const { user } = await api.get("/auth", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          setUser(user);
        } catch (err) {
          setUser(null);
          setAccessToken(null);
        }
      }
      setState("ready");
    })();
  }, [state]);

  const value = {
    state,
    user,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useRequiredAuth() {
  const { user, ...params } = useContext(AuthContext);
  if (!user) throw new Error("Not authenticated.");
  return { user, ...params };
}

export default function useAuth() {
  return useContext(AuthContext);
}

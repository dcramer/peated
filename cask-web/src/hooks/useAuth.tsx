import { createContext, useContext } from "react";
import useLocalStorage from "./useLocalStorage";
import { User } from "../types";
import api from "../lib/api";

type Auth = {
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  user: User | null;
};

const AuthContext = createContext<Auth>({
  login: (user, accessToken) => {
    throw new Error("Missing AuthProvider");
  },
  logout: () => {
    throw new Error("Missing AuthProvider");
  },
  user: null,
});

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useLocalStorage<User | null>("user", null);
  const [accessToken, setAccessToken] = useLocalStorage<string | null>(
    "token",
    null
  );

  api.setAccessToken(accessToken);

  // call this function when you want to authenticate the user
  const login = (user: User, accessToken: string) => {
    // kind of gross this exists here, need a better pattern
    api.setAccessToken(accessToken);
    setUser(user);
    setAccessToken(accessToken);
  };

  // call this function to sign out logged in user
  const logout = () => {
    api.setAccessToken(null);
    setUser(null);
    setAccessToken(null);
  };

  const value = {
    user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default function useAuth() {
  return useContext(AuthContext);
}

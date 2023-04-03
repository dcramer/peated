import { createContext, useCallback, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useLocalStorage from "./useLocalStorage";
import { User } from "../types";

type Auth = {
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<Auth>({
  login: async (user) => {},
  logout: async () => {},
  user: null,
});

export const AuthProvider = ({ children }: { children: any[] }) => {
  const [user, setUser] = useLocalStorage<User | null>("user", null);
  const navigate = useNavigate();

  // call this function when you want to authenticate the user
  const login = useCallback(
    async (user: User) => {
      setUser(user);
      navigate("/profile");
    },
    [navigate, setUser]
  );

  // call this function to sign out logged in user
  const logout = useCallback(async () => {
    setUser(null);
    navigate("/", { replace: true });
  }, [navigate, setUser]);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};

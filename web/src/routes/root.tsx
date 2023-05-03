import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import useAuth from "../hooks/useAuth";
import Screen from "../components/screen";

export default function Root() {
  const navigate = useNavigate();

  const auth = useAuth();
  useEffect(() => {
    if (!auth.user) {
      navigate("/login");
    }
  }, [auth]);

  if (!auth.user) return null;

  return (
    <Screen>
      <Outlet />
    </Screen>
  );
}

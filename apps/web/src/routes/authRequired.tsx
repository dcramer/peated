import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Spinner from "../components/spinner";
import useAuth from "../hooks/useAuth";

export default function AuthRequired() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, state } = useAuth();

  useEffect(() => {
    if (!user && state === "ready") {
      navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`);
    }
  }, [user?.id, state]);

  if (state === "loading" || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <Outlet />;
}

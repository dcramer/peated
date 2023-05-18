import { Suspense, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import ReloadPrompt from "../components/reloadPrompt";
import Screen from "../components/screen";
import Spinner from "../components/spinner";
import useAuth from "../hooks/useAuth";

export default function Root() {
  const navigate = useNavigate();
  const { user, state } = useAuth();

  useEffect(() => {
    if (!user && state === "ready") {
      navigate("/login");
    }
  }, [JSON.stringify(user), state]);

  if (state === "loading" || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Screen>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Outlet />
      </Suspense>
      <ReloadPrompt />
    </Screen>
  );
}

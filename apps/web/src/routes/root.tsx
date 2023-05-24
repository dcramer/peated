import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import ReloadPrompt from "../components/reloadPrompt";
import Screen from "../components/screen";
import Spinner from "../components/spinner";

export default function Root() {
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

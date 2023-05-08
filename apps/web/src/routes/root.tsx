import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";
import Screen from "../components/screen";
import ReloadPrompt from "../components/reloadPrompt";
import Spinner from "../components/spinner";

export default function Root() {
  const navigate = useNavigate();
  const { user, state } = useAuth();

  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransistionStage] = useState("fadeIn");

  useEffect(() => {
    if (location !== displayLocation) setTransistionStage("fadeOut");
  }, [location, displayLocation]);

  useEffect(() => {
    if (!user && state === "ready") {
      navigate("/login");
    }
  }, [JSON.stringify(user), state]);

  if (state === "loading" || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <Screen>
      <div
        className={`animate-${transitionStage}`}
        onAnimationEnd={() => {
          if (transitionStage === "fadeOut") {
            setTransistionStage("fadeIn");
            setDisplayLocation(location);
          }
        }}
      >
        <Outlet />
      </div>
      <ReloadPrompt />
    </Screen>
  );
}

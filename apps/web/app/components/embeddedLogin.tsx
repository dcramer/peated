import { useLocation } from "@remix-run/react";
import Button from "./button";

export default function EmbeddedLogin() {
  const location = useLocation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center p-4">
      <p className="text-light mb-4 text-sm">
        Looks like you'll need to login to participate here.
      </p>
      <Button
        to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`}
        color="highlight"
      >
        Login to Peated
      </Button>
    </div>
  );
}

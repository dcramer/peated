import { logout } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import Button from "./button";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      onClick={async () => {
        setLoading(true);
        try {
          await logout({ data: { redirectTo: "/" } });
        } catch (error) {
          console.error("Logout failed:", error);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
    >
      {loading ? "Logging out..." : "Sign Out"}
    </Button>
  );
}

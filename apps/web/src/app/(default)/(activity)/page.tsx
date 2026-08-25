import { getCurrentUser } from "@peated/web/lib/auth.server";
import Homepage from "./homepage";

export const fetchCache = "default-no-store";

export default async function Page() {
  const user = await getCurrentUser();

  return <Homepage isAuthenticated={Boolean(user)} />;
}

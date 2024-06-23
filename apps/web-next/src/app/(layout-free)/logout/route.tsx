import { logout } from "@peated/web/lib/auth.server";

export async function POST() {
  await logout();
}

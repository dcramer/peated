import { logout } from "@peated/web/lib/auth.actions";

export async function POST() {
  await logout();
}

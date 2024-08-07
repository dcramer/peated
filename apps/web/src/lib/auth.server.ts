import { getSession } from "@peated/web/lib/session.server";

export async function getCurrentUser() {
  let session = await getSession();
  return session.user;
}

export async function isLoggedIn() {
  const session = await getSession();
  return !!session.user;
}

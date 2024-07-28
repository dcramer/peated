import { getSession } from "@peated/web/lib/session.server";
import { updateSession } from "./auth.actions";

const SESSION_REFRESH = 60;

export async function getCurrentUser() {
  let session = await getSession();
  if (
    session.user &&
    (!session.ts || session.ts < new Date().getTime() / 1000 - SESSION_REFRESH)
  ) {
    console.log(`Refreshing session for user_id='${session.user.id}'`);
    session = await updateSession();
  }
  return session.user;
}

export async function isLoggedIn() {
  const session = await getSession();
  return !!session.user;
}

import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";

import api from "~/lib/api";
import {
  getAccessToken,
  getSession,
  getUser,
  logout,
  sessionStorage,
} from "~/services/session.server";
import type { SessionPayload } from "~/types";

export const authenticator = new Authenticator<SessionPayload>(sessionStorage);

authenticator.use(
  new FormStrategy(async ({ form }) => {
    const email = form.get("email");
    const password = form.get("password");
    const code = form.get("code");

    const session = code
      ? await api.post("/auth/google", {
          data: {
            code: code,
          },
        })
      : await api.post("/auth/basic", {
          data: {
            email,
            password,
          },
        });
    return session;
  }),
  "default",
);

export async function authMiddleware({ request }: { request: Request }) {
  const session = await getSession(request);
  const user = await getUser(session);
  const accessToken = await getAccessToken(session);

  if (accessToken) {
    api.setAccessToken(accessToken);
  } else if (user) {
    return await logout(request);
  }
}

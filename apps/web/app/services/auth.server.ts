import { sessionStorage } from "@peated/web/services/session.server";
import type { SessionPayload } from "@peated/web/types";
import { TRPCClientError } from "@trpc/client";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";

export const authenticator = new Authenticator<SessionPayload | null>(
  sessionStorage,
);

authenticator.use(
  new FormStrategy(async ({ form, context }) => {
    if (!context) throw new Error("Where da context?");
    const { api } = context;
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const code = form.get("code") as string;

    try {
      const session = code
        ? await api.post("/auth/google", {
            data: {
              code,
            },
          })
        : await api.post("/auth/basic", {
            data: {
              email,
              password,
            },
          });

      return session;
    } catch (err) {
      if (err instanceof TRPCClientError && err.data.code === "UNAUTHORIZED") {
        return null;
      }
      console.error({ err });
      throw err;
    }
  }),
  "default",
);

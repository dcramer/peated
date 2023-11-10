import type { AppRouter } from "@peated/server/src/trpc/router";
import {
  createTRPCProxyClient,
  httpBatchLink,
  TRPCClientError,
} from "@trpc/client";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import config from "~/config";
import { sessionStorage } from "~/services/session.server";
import type { SessionPayload } from "~/types";

export const authenticator = new Authenticator<SessionPayload | null>(
  sessionStorage,
);

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${config.API_SERVER}/trpc`,
    }),
  ],
});

authenticator.use(
  new FormStrategy(async ({ form }) => {
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const code = form.get("code") as string;

    try {
      const session = code
        ? await trpc.authGoogle.mutate({
            code,
          })
        : await trpc.authBasic.mutate({
            email,
            password,
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

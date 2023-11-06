import { setUser } from "@sentry/node-experimental";
import { type inferAsyncReturnType } from "@trpc/server";
import { type CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getUserFromHeader } from "../lib/auth";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const user = await getUserFromHeader(req.headers["authorization"]);

  user
    ? setUser({
        id: `${user.id}`,
        username: user.username,
        email: user.email,
      })
    : setUser(null);

  return { user };
}

export type Context = inferAsyncReturnType<typeof createContext>;

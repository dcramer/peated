import { setUser } from "@sentry/node";
import { type CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getUserFromHeader } from "../lib/auth";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const user = await getUserFromHeader(req.headers["authorization"]);

  user
    ? setUser({
        id: `${user.id}`,
        username: user.username,
        email: user.email,
        ip_address: req.ip,
      })
    : setUser({
        ip_address: req.ip,
      });

  return { user, maxAge: 0 };
}

export type Context = Awaited<typeof createContext>;

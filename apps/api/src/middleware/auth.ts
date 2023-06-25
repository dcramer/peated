import { setUser } from "@sentry/node";
import { eq } from "drizzle-orm";
import type { onRequestHookHandler } from "fastify";
import { db } from "../db";
import { users } from "../db/schema";
import { verifyToken } from "../lib/auth";
import { logError } from "../lib/log";

const getUser = async (req: any) => {
  const auth = req.headers["authorization"];
  const token = auth?.replace("Bearer ", "");
  if (!token) return null;

  const { id } = await verifyToken(token);
  if (!id) {
    logError("Invalid token");
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    logError("User not found", { userId: id });
    return null;
  }

  if (!user.active) {
    // this code path is expected, no need to log
    return null;
  }

  setUser({
    id: `${user.id}`,
    username: user.username,
    email: user.email,
  });

  return user;
};

// XXX: this happens globally at the app level
export const injectAuth: onRequestHookHandler = async (req, res) => {
  const user = await getUser(req);
  req.user = user;
};

export const requireAuth: onRequestHookHandler = async (req, res) => {
  if (req.user === undefined) {
    const user = await getUser(req);
    req.user = user;
  }
  if (!req.user) {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    return res.status(401).send({
      error: "Unauthorized!",
      name: token ? "invalid_token" : "auth_required",
    });
  }
};
export const requireAdmin: onRequestHookHandler = async (req, res) => {
  if (req.user === undefined) {
    const user = await getUser(req);
    req.user = user;
  }
  if (!req.user) {
    return res
      .status(401)
      .send({ error: "Unauthorized!", name: "invalid_token" });
  }

  if (!req.user.admin) {
    return res
      .status(403)
      .send({ error: "Unauthorized!", name: "no_permission" });
  }
};

export const requireMod: onRequestHookHandler = async (req, res) => {
  if (req.user === undefined) {
    const user = await getUser(req);
    req.user = user;
  }
  if (!req.user) {
    return res
      .status(401)
      .send({ error: "Unauthorized!", name: "invalid_token" });
  }

  if (!req.user.mod && !req.user.admin) {
    return res
      .status(403)
      .send({ error: "Unauthorized!", name: "no_permission" });
  }
};

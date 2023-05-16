import { eq } from "drizzle-orm";
import { onRequestHookHandler } from "fastify";
import { db } from "../db";
import { users } from "../db/schema";
import { verifyToken } from "../lib/auth";

const getUser = async (req: any) => {
  const auth = req.headers["authorization"];
  const token = auth?.replace("Bearer ", "");

  const { id } = await verifyToken(token);
  if (!id) throw new Error("Invalid token");
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new Error("User not found");
  if (!user.active) throw new Error("User not active");
  return user;
};

// TODO: need to chain these to DRY it up
export const requireAuth: onRequestHookHandler = async (req, res) => {
  try {
    const user = await getUser(req);
    req.user = user;
  } catch (error) {
    console.error(error);
    return res
      .status(401)
      .send({ error: "Unauthorized!", name: "invalid_token" });
  }
};

export const injectAuth: onRequestHookHandler = async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");
    if (token) {
      const { id } = await verifyToken(token);
      [req.user] = await db.select().from(users).where(eq(users.id, id));
      if (!req.user.active) throw new Error("User not active");
    } else {
      req.user = null;
    }
  } catch (error) {
    console.error(error);
    req.user = null;
  }
};

export const requireAdmin: onRequestHookHandler = async (req, res) => {
  try {
    const user = await getUser(req);
    req.user = user;
  } catch (error) {
    console.error(error);
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
  try {
    const user = await getUser(req);
    req.user = user;
  } catch (error) {
    console.error(error);
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

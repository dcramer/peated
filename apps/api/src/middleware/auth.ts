import { eq } from "drizzle-orm";
import { onRequestHookHandler } from "fastify";
import { db } from "../db";
import { users } from "../db/schema";
import { verifyToken } from "../lib/auth";

export const requireAuth: onRequestHookHandler = async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    const { id } = await verifyToken(token);
    [req.user] = await db.select().from(users).where(eq(users.id, id));
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
    } else {
      req.user = null;
    }
  } catch (error) {
    console.error(error);
    req.user = null;
  }
};

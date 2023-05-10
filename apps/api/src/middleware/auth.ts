import { onRequestHookHandler } from "fastify";
import { verifyToken } from "../lib/auth";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

export const validateRequest: onRequestHookHandler = async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    const { id } = await verifyToken(token);
    [req.user] = await db.select().from(users).where(eq(users.id, id));
  } catch (error) {
    console.error(error);
    return res.status(401).send({ error: "Unauthorized!" });
  }
};

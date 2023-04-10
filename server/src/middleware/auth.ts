import { onRequestHookHandler } from "fastify";
import { verifyToken } from "../lib/auth";
import { prisma } from "../lib/db";

export const validateRequest: onRequestHookHandler = async (req, res) => {
  try {
    let auth = req.headers["authorization"];
    let token = auth?.replace("Bearer ", "");

    let { id } = await verifyToken(token);
    req.user = await prisma.user.findUniqueOrThrow({
      where: { id },
    });
  } catch (error) {
    return res.status(401).send({ error: "Unauthorized!" });
  }
};

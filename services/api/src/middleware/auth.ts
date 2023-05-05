import { onRequestHookHandler } from "fastify";
import { verifyToken } from "../lib/auth";
import { prisma } from "../lib/db";

export const validateRequest: onRequestHookHandler = async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    const { id } = await verifyToken(token);
    req.user = await prisma.user.findUniqueOrThrow({
      where: { id },
    });
  } catch (error) {
    console.error(error);
    return res.status(401).send({ error: "Unauthorized!" });
  }
};

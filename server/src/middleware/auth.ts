import { onRequestHookHandler } from "fastify";
import { verifyToken } from "../lib/auth";

export const validateRequest: onRequestHookHandler = async (req, res) => {
  try {
    let auth = req.headers["authorization"];
    let token = auth?.replace("Bearer ", "");

    let user = await verifyToken(token);
    req.user = user;
  } catch (error) {
    return res.status(401).send({ error: "Unauthorized!" });
  }
};

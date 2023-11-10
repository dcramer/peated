import type { onRequestHookHandler } from "fastify";
import { getUserFromHeader } from "../lib/auth";

// XXX: this happens globally at the app level
export const injectAuth: onRequestHookHandler = async (req, res) => {
  const user = await getUserFromHeader(req.headers["authorization"]);
  req.user = user;
};

export const requireAuth: onRequestHookHandler = async (req, res) => {
  if (req.user === undefined) {
    const user = await getUserFromHeader(req.headers["authorization"]);
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
    const user = await getUserFromHeader(req.headers["authorization"]);
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
    const user = await getUserFromHeader(req.headers["authorization"]);
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

import type { onRequestHookHandler } from "fastify";
import { ForbiddenError, UnauthorizedError } from "http-errors-enhanced";
import type { User } from "../db/schema";
import { getUserFromHeader } from "../lib/auth";

// XXX: this happens globally at the app level
export const injectAuth: onRequestHookHandler = async (req, res) => {
  const user = await getUserFromHeader(req.headers["authorization"]);
  req.requestContext.set("user", user);
};

export const requireAuth: onRequestHookHandler = async (req, res) => {
  let user: User | null | undefined = req.requestContext.get("user");
  if (user === undefined) {
    user = await getUserFromHeader(req.headers["authorization"]);
    req.requestContext.set("user", user);
  }

  if (!user) {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    throw new UnauthorizedError(token ? "Invalid token." : undefined, {
      name: token ? "invalid_token" : "auth_required",
    });
  }
};
export const requireAdmin: onRequestHookHandler = async (req, res) => {
  let user: User | null | undefined = req.requestContext.get("user");
  if (user === undefined) {
    user = await getUserFromHeader(req.headers["authorization"]);
    req.requestContext.set("user", user);
  }

  if (!user) {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    throw new UnauthorizedError(token ? "Invalid token." : undefined, {
      name: token ? "invalid_token" : "auth_required",
    });
  }

  if (!user.admin) {
    throw new ForbiddenError("Unauthorized", {
      name: "no_permission",
    });
  }
};

export const requireMod: onRequestHookHandler = async (req, res) => {
  let user: User | null | undefined = req.requestContext.get("user");
  if (user === undefined) {
    user = await getUserFromHeader(req.headers["authorization"]);
    req.requestContext.set("user", user);
  }

  if (!user) {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    throw new UnauthorizedError(token ? "Invalid token." : undefined, {
      name: token ? "invalid_token" : "auth_required",
    });
  }

  if (!user.mod && !user.admin) {
    throw new ForbiddenError("Unauthorized", {
      name: "no_permission",
    });
  }
};

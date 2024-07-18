import { trpcMiddleware } from "@sentry/node";
import { TRPCError, initTRPC } from "@trpc/server";
import SuperJSON from "superjson";
import { ZodError } from "zod";
import { type Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: SuperJSON,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.admin) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isMod = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.admin && !ctx.user?.mod) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const middleware = t.middleware;
export const publicProcedure = t.procedure.use(trpcMiddleware());
export const authedProcedure = publicProcedure.use(isAuthed);
export const adminProcedure = publicProcedure.use(isAdmin);
export const modProcedure = publicProcedure.use(isMod);

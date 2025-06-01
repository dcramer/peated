"use server";

import { safe } from "@orpc/client";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { z } from "zod";
import { getSafeRedirect } from "./auth";
import { getServerClient } from "./orpc/client.server";
import { useAppSession } from "./session.server";

const SESSION_REFRESH = 60 * 60; // 1 hour

export const logout = createServerFn({ method: "POST" })
  .validator(z.object({ redirectTo: z.string().optional().default("/") }))
  .handler(async ({ data }) => {
    const session = await useAppSession();
    session.clear();
    redirect({ to: getSafeRedirect(data.redirectTo) });
  });

export const authenticate = createServerFn({ method: "POST" })
  .validator(
    z.union([
      z.object({
        email: z.string().email(),
        password: z.string().optional(),
        redirectTo: z.string().optional().default("/"),
      }),
      z.object({
        code: z.string(),
        redirectTo: z.string().optional().default("/"),
      }),
    ])
  )
  .handler(async (ctx) => {
    const session = await useAppSession();

    const client = getServerClient();

    if ("email" in ctx.data && !ctx.data.password) {
      const { error, isDefined } = await safe(
        client.auth.magicLink.create({ email: ctx.data.email })
      );
      if (isDefined) {
        return {
          magicLink: false,
          error: error.message,
        };
      }
      if (error) {
        return {
          magicLink: false,
          error: "Internal server error.",
        };
      }

      return {
        magicLink: true,
        error: null,
      };
    }

    const { error, isDefined, data } = await safe(
      "code" in ctx.data
        ? client.auth.login({
            code: ctx.data.code,
          })
        : client.auth.login({
            email: ctx.data.email,
            password: ctx.data.password!,
          })
    );

    if (isDefined) {
      return {
        magicLink: false,
        error: error.message,
      };
    }
    if (error) {
      return {
        magicLink: false,
        error: "Internal server error.",
      };
    }

    await session.update({
      user: data.user,
      accessToken: data.accessToken ?? null,
      ts: new Date().getTime(),
    });

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
    // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676

    if (!data.user.verified) {
      redirect({ to: "/verify" });
    } else {
      redirect({ to: getSafeRedirect(ctx.data.redirectTo) });
    }
  });

export const register = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string(),
      username: z.string(),
      redirectTo: z.string().optional().default("/"),
    })
  )
  .handler(async (ctx) => {
    const session = await useAppSession();

    const client = getServerClient();

    const { error, isDefined, data } = await safe(
      client.auth.register({
        email: ctx.data.email,
        password: ctx.data.password,
        username: ctx.data.username,
      })
    );

    if (isDefined) {
      return { ok: false, error: error.message };
    }
    if (error) {
      return { ok: false, error: "Internal server error." };
    }

    await session.update({
      user: data.user,
      accessToken: data.accessToken ?? null,
      ts: new Date().getTime(),
    });

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
    // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676

    throw redirect({ to: "/verify" });
  });

export const resendVerification = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await useAppSession();

    const client = getServerClient({ accessToken: session.data.accessToken! });
    const { isDefined, error } = await safe(client.email.resendVerification());

    if (isDefined && error.name === "CONFLICT") {
      return { ok: true, alreadyVerified: true };
    }
    if (error) {
      return { ok: false, error: "Internal server error." };
    }

    return { ok: true };
  }
);

export const passwordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async (ctx) => {
    const client = getServerClient();

    const { error, isDefined } = await safe(
      client.auth.passwordReset.create({ email: ctx.data.email })
    );

    if (isDefined) {
      return { ok: false, error: error.message };
    }
    if (error) {
      return { ok: false, error: "Internal server error." };
    }

    return { ok: true };
  });

export const passwordResetConfirm = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), password: z.string() }))
  .handler(async (ctx) => {
    const token = ctx.data.token;
    const password = ctx.data.password;

    const session = await useAppSession();
    const client = getServerClient();

    const { error, isDefined, data } = await safe(
      client.auth.passwordReset.confirm({ token, password })
    );

    if (isDefined) {
      return { ok: false, error: error.message };
    }
    if (error) {
      return { ok: false, error: "Internal server error." };
    }

    await session.update({
      user: data.user,
      accessToken: data.accessToken ?? null,
      ts: new Date().getTime(),
    });

    return { ok: true };
  });

export const updateSession = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await useAppSession();
    const client = getServerClient({ accessToken: session.data.accessToken! });

    const user = await client.users.details({ user: "me" });
    await session.update({
      user: user,
      ts: new Date().getTime(),
    });

    return {
      user: user,
      accessToken: session.data.accessToken,
      ts: session.data.ts,
    };
  }
);

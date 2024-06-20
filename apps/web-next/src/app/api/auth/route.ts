"use server";

// Based on https://github.com/vvo/iron-session/blob/main/examples/next/src/app/app-router-client-component-route-handler-swr/session/route.ts

import { makeTRPCClient } from "@peated/server/src/lib/trpc";
import {
  defaultSession,
  sessionOptions,
  type SessionData,
} from "@peated/web-next/auth";
import config from "@peated/web-next/config";
import { TRPCClientError } from "@trpc/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

const trpc = makeTRPCClient(config.API_SERVER, "");

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");
  const form = await request.formData();

  const email = (form.get("email") || "") as string;
  const password = (form.get("password") || "") as string;
  const code = form.get("code") as string;

  try {
    const data = code
      ? await trpc.authGoogle.mutate({
          code,
        })
      : await trpc.authBasic.mutate({
          email,
          password,
        });

    session.user = data.user;
    session.accessToken = data.accessToken;

    await session.save();

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
    // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676
  } catch (err) {
    if (err instanceof TRPCClientError && err.data.code === "UNAUTHORIZED") {
      return Response.json({ error: "Invalid credentials" });
    }

    throw err;
  }

  return Response.json(session);
}

export async function GET(request: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  const action = new URL(request.url).searchParams.get("action");
  if (action === "logout") {
    session.destroy();
    return redirect("/");
  }

  if (!session.user) {
    return Response.json(defaultSession);
  }

  return Response.json(session);
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  session.destroy();

  return Response.json(defaultSession);
}

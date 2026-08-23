import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import { z } from "zod";
import { normalizeServerUrl } from "./config";

export type PeatedClient = RouterClient<Router>;
export const PeatedApiValueSchema = z.json();
export type PeatedApiValue = z.infer<typeof PeatedApiValueSchema>;

export function createPeatedClient({
  accessToken,
  apiServer,
}: {
  accessToken: string;
  apiServer: string;
}): PeatedClient {
  const server = normalizeServerUrl(apiServer);
  const link = new RPCLink({
    url: `${server}/rpc`,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "user-agent": "@peated/cli (orpc/client)",
    },
  });

  return createORPCClient(link);
}

export class PeatedApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: PeatedApiValue,
  ) {
    super(message);
    this.name = "PeatedApiError";
  }
}

function apiUrl(apiServer: string, path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(
      `Invalid Peated API path: ${path}. Use a path such as /bottles/123.`,
    );
  }
  const url = new URL(`/v1${path}`, `${normalizeServerUrl(apiServer)}/`);
  if (!url.pathname.startsWith("/v1/")) {
    throw new Error(
      `Invalid Peated API path: ${path}. The path must stay under /v1.`,
    );
  }
  return url;
}

async function responseBody(response: Response): Promise<PeatedApiValue> {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return PeatedApiValueSchema.parse(JSON.parse(text));
  }
  return text;
}

export async function requestPeatedApi({
  accessToken,
  apiServer,
  method,
  path,
  body,
  fetch: fetchImplementation = fetch,
}: {
  accessToken: string;
  apiServer: string;
  method: string;
  path: string;
  body?: PeatedApiValue;
  fetch?: typeof fetch;
}): Promise<PeatedApiValue> {
  const normalizedMethod = method.toUpperCase();
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${accessToken}`,
    "user-agent": "@peated/cli (openapi/client)",
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  const response = await fetchImplementation(apiUrl(apiServer, path), {
    method: normalizedMethod,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsedBody = await responseBody(response);

  if (!response.ok) {
    throw new PeatedApiError(
      `Peated API ${normalizedMethod} ${path} failed with HTTP ${response.status}.`,
      response.status,
      parsedBody,
    );
  }

  return parsedBody;
}

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import { normalizeServerUrl, OAUTH_CALLBACK_PATH } from "./config";
import type { Credentials } from "./credentials";

const OAuthTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    token_type: z.literal("Bearer"),
    expires_in: z.number().int().positive(),
  })
  .strict();

const OAuthErrorResponseSchema = z
  .object({ error: z.string().min(1) })
  .passthrough();

type CallbackServer = {
  redirectUri: string;
  waitForCode: () => Promise<string>;
  close: () => Promise<void>;
};

function sendCallbackResponse(
  response: ServerResponse,
  status: number,
  message: string,
  onSent?: () => void,
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    connection: "close",
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(`${message}\n`, onSent);
}

async function startCallbackServer({
  state,
  timeoutMs,
}: {
  state: string;
  timeoutMs: number;
}): Promise<CallbackServer> {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  let settled = false;
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server: Server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      request.method !== "GET" ||
      requestUrl.pathname !== OAUTH_CALLBACK_PATH
    ) {
      sendCallbackResponse(response, 404, "Not found.");
      return;
    }
    if (requestUrl.searchParams.get("state") !== state) {
      sendCallbackResponse(response, 400, "Invalid OAuth state.");
      return;
    }

    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError) {
      sendCallbackResponse(
        response,
        400,
        "Peated authorization was denied.",
        () => {
          settled = true;
          rejectCode(new Error(`Peated authorization failed: ${oauthError}`));
        },
      );
      return;
    }

    const authorizationCode = requestUrl.searchParams.get("code");
    if (!authorizationCode) {
      sendCallbackResponse(response, 400, "Missing authorization code.");
      return;
    }

    sendCallbackResponse(
      response,
      200,
      "Peated authorization complete. You can return to the terminal.",
      () => {
        settled = true;
        resolveCode(authorizationCode);
      },
    );
  });

  server.on("error", (error) => {
    if (!settled) rejectCode(error);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
    server.listen(0, "127.0.0.1");
  });

  const address = server.address();
  const callbackAddress = z
    .object({ port: z.number().int().positive() })
    .safeParse(address);
  if (!callbackAddress.success) {
    server.close();
    throw new Error("Unable to determine the OAuth callback port.");
  }

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      rejectCode(new Error("Timed out waiting for Peated authorization."));
    }
  }, timeoutMs);

  return {
    redirectUri: `http://127.0.0.1:${callbackAddress.data.port}${OAUTH_CALLBACK_PATH}`,
    waitForCode: () => code,
    close: async () => {
      clearTimeout(timeout);
      if (!server.listening) return;
      // The callback owns this short-lived listener and must not let a browser
      // keep-alive connection hold the CLI open after the response is flushed.
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}

export function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer.exe"
        : "xdg-open";
  const child = spawn(command, [url], { detached: true, stdio: "ignore" });
  // Opening the browser is best-effort because the authorization URL is also
  // printed for terminals without desktop integration.
  child.once("error", () => undefined);
  child.unref();
}

export async function authorizeWithOAuth({
  apiServer,
  webServer,
  clientId,
  onAuthorize,
  fetch: fetchImplementation = fetch,
  now = Date.now,
  timeoutMs = 5 * 60 * 1000,
}: {
  apiServer: string;
  webServer: string;
  clientId: string;
  onAuthorize: (url: string) => void | Promise<void>;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}): Promise<Credentials> {
  const normalizedApiServer = normalizeServerUrl(apiServer);
  const normalizedWebServer = normalizeServerUrl(webServer);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const callback = await startCallbackServer({ state, timeoutMs });

  try {
    const authorizationUrl = new URL("/oauth/authorize", normalizedWebServer);
    authorizationUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callback.redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

    const [authorizationCode] = await Promise.all([
      callback.waitForCode(),
      onAuthorize(authorizationUrl.toString()),
    ]);
    const response = await fetchImplementation(
      new URL("/oauth/token", normalizedApiServer),
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "@peated/cli (oauth/client)",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: authorizationCode,
          client_id: clientId,
          redirect_uri: callback.redirectUri,
          code_verifier: verifier,
        }),
      },
    );
    const responseBody: unknown = await response.json();

    if (!response.ok) {
      const parsedError = OAuthErrorResponseSchema.safeParse(responseBody);
      throw new Error(
        `Peated token exchange failed: ${parsedError.success ? parsedError.data.error : `HTTP ${response.status}`}`,
      );
    }

    const token = OAuthTokenResponseSchema.parse(responseBody);
    return {
      accessToken: token.access_token,
      apiServer: normalizedApiServer,
      clientId,
      expiresAt: new Date(now() + token.expires_in * 1000).toISOString(),
    };
  } finally {
    await callback.close();
  }
}

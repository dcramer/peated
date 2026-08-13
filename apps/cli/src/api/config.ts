export const DEFAULT_API_SERVER = "https://api.peated.com";
export const DEFAULT_WEB_SERVER = "https://peated.com";
export const DEFAULT_OAUTH_CLIENT_ID = "CTQLxbH7tzvZnIMYvniLthOk";
export const OAUTH_CALLBACK_PATH = "/oauth/callback";
export const OAUTH_REGISTERED_REDIRECT_URI = `http://127.0.0.1${OAUTH_CALLBACK_PATH}`;

export function resolveOAuthClientId(
  option: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return option ?? env.PEATED_OAUTH_CLIENT_ID ?? DEFAULT_OAUTH_CLIENT_ID;
}

export function normalizeServerUrl(value: string): string {
  const url = new URL(value);
  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error(
      `Refusing insecure Peated server URL: ${value}. Use HTTPS or an HTTP loopback URL.`,
    );
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `Invalid Peated server URL: ${value}. Use an origin without credentials, a path, a query, or a fragment.`,
    );
  }

  return url.toString().replace(/\/$/, "");
}

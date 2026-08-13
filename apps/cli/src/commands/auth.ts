import program from "@peated/cli/program";
import { createPeatedClient } from "../api/client";
import {
  DEFAULT_API_SERVER,
  DEFAULT_WEB_SERVER,
  resolveOAuthClientId,
} from "../api/config";
import {
  credentialsExpired,
  deleteCredentials,
  loadCredentials,
  saveCredentials,
} from "../api/credentials";
import { authorizeWithOAuth, openBrowser } from "../api/oauth";

const subcommand = program
  .command("auth")
  .description("Authenticate the local CLI with Peated OAuth");

subcommand
  .command("login")
  .description("Authorize this CLI through Peated in your browser")
  .option(
    "--client-id <id>",
    "OAuth public client ID (or PEATED_OAUTH_CLIENT_ID)",
  )
  .option(
    "--api-server <url>",
    "Peated API server",
    process.env.PEATED_API_SERVER ?? DEFAULT_API_SERVER,
  )
  .option(
    "--web-server <url>",
    "Peated web server",
    process.env.PEATED_WEB_SERVER ?? DEFAULT_WEB_SERVER,
  )
  .option("--no-open", "Print the authorization URL without opening a browser")
  .action(async (options) => {
    const clientId = resolveOAuthClientId(options.clientId);

    const credentials = await authorizeWithOAuth({
      apiServer: options.apiServer,
      webServer: options.webServer,
      clientId,
      onAuthorize: (url) => {
        console.log(`Authorize Peated CLI:\n${url}`);
        if (options.open) openBrowser(url);
      },
    });
    const { user } = await createPeatedClient(credentials).auth.me();
    await saveCredentials(credentials);
    console.log(
      `Logged in to ${credentials.apiServer} as @${user.username}. Token expires ${credentials.expiresAt}.`,
    );
  });

subcommand
  .command("status")
  .description("Show the current local Peated login")
  .action(async () => {
    const credentials = await loadCredentials();
    if (!credentials) {
      console.log("Not logged in. Run `pnpm cli auth login`.");
      return;
    }
    if (credentialsExpired(credentials)) {
      console.log(
        `Peated login expired ${credentials.expiresAt}. Run \`pnpm cli auth login\` again.`,
      );
      return;
    }

    const { user } = await createPeatedClient(credentials).auth.me();
    console.log(
      `Logged in to ${credentials.apiServer} as @${user.username}. Token expires ${credentials.expiresAt}.`,
    );
  });

subcommand
  .command("logout")
  .description("Delete the locally stored Peated token")
  .action(async () => {
    const deleted = await deleteCredentials();
    console.log(deleted ? "Logged out of Peated." : "Not logged in.");
  });

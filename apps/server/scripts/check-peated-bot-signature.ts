import { BOT_USER_AGENT, signRequest } from "@peated/bot";
import config from "@peated/server/config";

const url = new URL("https://crawltest.com/cdn-cgi/web-bot-auth");
const headers = await signRequest({
  url,
  headers: { "User-Agent": BOT_USER_AGENT },
  created: new Date(),
  privateJwk: config.PEATED_BOT_PRIVATE_JWK,
});

if (!headers.has("Signature")) {
  throw new Error("PEATED_BOT_PRIVATE_JWK must be configured for this check.");
}

const response = await fetch(url, { headers });
console.log(`Cloudflare crawl test returned HTTP ${response.status}.`);

if (response.status !== 200 && response.status !== 401) {
  process.exitCode = 1;
}

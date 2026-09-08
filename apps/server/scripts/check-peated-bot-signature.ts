import { BOT_USER_AGENT } from "@peated/server/constants";
import { signScraperRequest } from "@peated/server/scraper/signing";

const url = new URL("https://crawltest.com/cdn-cgi/web-bot-auth");
const headers = await signScraperRequest(
  url,
  { "User-Agent": BOT_USER_AGENT },
  new Date(),
);

if (!headers.has("Signature")) {
  throw new Error("PEATED_BOT_PRIVATE_JWK must be configured for this check.");
}

const response = await fetch(url, { headers });
console.log(`Cloudflare crawl test returned HTTP ${response.status}.`);

if (response.status !== 200 && response.status !== 401) {
  process.exitCode = 1;
}

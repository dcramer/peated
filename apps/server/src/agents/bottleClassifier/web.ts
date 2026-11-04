import type { PageRead, PeatedBot } from "@peated/bot";
import { readScotchWhiskyAuctionLotPage } from "@peated/server/scraper/adapters/scotchWhiskyAuctionDetails";
import { isScotchWhiskyAuctionsLotUrl } from "@peated/server/scraper/adapters/scotchWhiskyAuctions";

type ClassifierWeb = Pick<PeatedBot, "readPage" | "searchWeb">;

/**
 * The Bottle classifier's web reads through PeatedBot.
 *
 * Blocked websites policy exception (owner: auctions): a Scotch Whisky
 * Auctions lot page is read as HTML, directly as PeatedBot unless the website
 * is marked blocked, and only its lot heading and description reach the
 * model. Firecrawl runs the page's script, which hides the lot behind an age
 * question, so a markdown read returns only that question.
 */
export function createBottleClassifierWeb(bot: ClassifierWeb): ClassifierWeb {
  return {
    searchWeb: bot.searchWeb,
    readPage: async (input) => {
      if (
        input.format !== "markdown" ||
        !isScotchWhiskyAuctionsLotUrl(input.url)
      )
        return await bot.readPage(input);
      const read = await bot.readPage({ url: input.url, format: "html" });
      if (read.status !== "ok") return read;
      const lot = readScotchWhiskyAuctionLotPage(read.content);
      if (!lot)
        return {
          status: "failed",
          url: read.url,
          reason: "not_found",
          httpStatus: null,
        } satisfies PageRead;
      return {
        ...read,
        title: lot.title ?? read.title,
        content: lot.content,
      };
    },
  };
}

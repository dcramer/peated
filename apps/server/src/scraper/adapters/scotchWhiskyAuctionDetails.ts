import {
  BottleExtractedDetailsSchema,
  type BottleExtractedDetails,
} from "@peated/bottle-classifier/contract";
import { load } from "cheerio";

/** SWA collection keeps explicit identity facts, not descriptions, tasting notes, or graph prices. */
export function parseScotchWhiskyAuctionDetails(html: string) {
  const $ = load(html);
  const name = $("main h1").text().trim();
  if (!name || !$(".lotinfo .descr").length)
    throw new Error("Auction lot detail facts are missing.");
  const facts: Partial<BottleExtractedDetails> = {};
  let volume: number | null = null;
  function setFact<K extends keyof BottleExtractedDetails>(
    key: K,
    value: BottleExtractedDetails[K],
  ) {
    if (facts[key] != null && facts[key] !== value)
      throw new Error(`Conflicting auction detail fact: ${key}.`);
    facts[key] = value;
  }
  for (const element of $(".lotinfo .descr p").toArray()) {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const date = text.match(
      /^(Distilled|Bottled):\s*(\d{2})\.(\d{2})\.(\d{4})$/i,
    );
    if (date) {
      const day = Number(date[2]);
      const month = Number(date[3]);
      const year = Number(date[4]);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        year >= 1800 &&
        year <= new Date().getUTCFullYear() &&
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      )
        setFact(
          date[1].toLowerCase() === "distilled"
            ? "vintage_year"
            : "bottling_year",
          year,
        );
    }
    const cask = text.match(/^Cask Number:\s*#?([\w/-]{1,100})$/i);
    if (cask) setFact("cask_number", cask[1]);
    const strength = text.match(
      /^(\d+(?:\.\d+)?)%\s*ABV\s*\/\s*(\d+(?:\.\d+)?)\s*(ml|cl|l)$/i,
    );
    if (strength) {
      const abv = Number(strength[1]);
      const ml =
        Number(strength[2]) *
        ({ ml: 1, cl: 10, l: 1000 }[strength[3].toLowerCase()] ?? 0);
      if (abv > 0 && abv <= 100) setFact("abv", abv);
      if (Number.isInteger(ml) && ml > 0) {
        if (volume !== null && volume !== ml)
          throw new Error("Conflicting auction detail volume.");
        volume = ml;
      }
    }
    const count = text.match(/^Bottle Number:\s*(\d+)\s*\/\s*(\d+)$/i);
    if (count && Number(count[1]) > 0 && Number(count[1]) <= Number(count[2]))
      setFact("outturn", Number(count[2]));
    if (/^Cask Strength$/i.test(text)) setFact("cask_strength", true);
  }
  return {
    name,
    volume,
    sourceBottleIdentity: Object.keys(facts).length
      ? BottleExtractedDetailsSchema.parse(facts)
      : null,
  };
}

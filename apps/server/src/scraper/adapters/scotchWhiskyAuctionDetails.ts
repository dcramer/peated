import {
  BottleExtractedDetailsSchema,
  type BottleExtractedDetails,
} from "@peated/bottle-classifier/contract";
import { load } from "cheerio";

/**
 * Returns a lot page's heading and description as text for a classifier page
 * read, or null when the page has no lot. Every lot page ships its
 * description in the HTML, then a script blanks the page behind an age
 * question, so a reader that runs scripts, such as Firecrawl, gets only the
 * question. The text is read for one classifier run and never saved on the lot.
 */
export function readScotchWhiskyAuctionLotPage(html: string) {
  const $ = load(html);
  const name = $("main h1").first().text().trim();
  const description = $(".lotinfo .descr").first();
  if (!name || !description.length) return null;
  const lines = [`# ${name}`];
  const lotNumber = $(".lotinfo .lotno").first().text().trim();
  if (lotNumber) lines.push(lotNumber);
  const paragraphs = description.find("p").toArray();
  for (const element of paragraphs.length ? paragraphs : [description]) {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
  }
  return {
    title: $("title").first().text().trim() || null,
    content: lines.join("\n\n"),
  };
}

/** SWA collection keeps explicit identity facts, not descriptions, tasting notes, or graph prices. */
export function parseScotchWhiskyAuctionDetails(html: string) {
  const $ = load(html);
  const name = $("main h1").text().trim();
  if (!name || !$(".lotinfo .descr").length)
    throw new Error("Auction lot detail facts are missing.");
  const facts: Partial<BottleExtractedDetails> = {};
  // A page with conflicting facts, such as a two-bottle set, leaves them unknown.
  const conflicts = new Set<keyof BottleExtractedDetails | "volume">();
  let volume: number | null = null;
  function setFact<K extends keyof BottleExtractedDetails>(
    key: K,
    value: BottleExtractedDetails[K],
  ) {
    if (conflicts.has(key)) return;
    if (facts[key] != null && facts[key] !== value) {
      conflicts.add(key);
      delete facts[key];
      return;
    }
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
      if (Number.isInteger(ml) && ml > 0 && !conflicts.has("volume")) {
        if (volume !== null && volume !== ml) {
          conflicts.add("volume");
          volume = null;
        } else volume = ml;
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

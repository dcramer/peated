import type { ExternalSiteType } from "@peated/server/types";
import { type JobName } from "./types";

export function getJobForSite(site: ExternalSiteType): JobName {
  switch (site) {
    case "totalwine":
      return "ScrapeTotalWine";
    case "astorwines":
      return "ScrapeAstorWines";
    case "reservebar":
      return "ScrapeReserveBar";
    case "smws":
      return "ScrapeSMWS";
    case "smwsa":
      return "ScrapeSMWSA";
    case "whiskyadvocate":
      return "ScrapeWhiskyAdvocate";
    case "woodencork":
      return "ScrapeWoodenCork";
    case "healthyspirits":
      return "ScrapeHealthySpirits";
    default:
      throw new Error("Unknown site");
  }
}

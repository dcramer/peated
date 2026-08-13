import type { ExternalSiteType } from "@peated/server/types";
import { type JobName } from "./types";

export function getJobForSite(site: ExternalSiteType): JobName {
  switch (site) {
    case "totalwine":
      return "ScrapeTotalWine";
    case "astorwines":
      return "ScrapeAstorWines";
    case "berrybrosrudd":
      return "ScrapeBerryBrosRudd";
    case "cadenheads":
      return "ScrapeCadenheads";
    case "compassbox":
      return "ScrapeCompassBox";
    case "decadentdrinks":
      return "ScrapeDecadentDrinks";
    case "douglaslaing":
      return "ScrapeDouglasLaing";
    case "dramfool":
      return "ScrapeDramfool";
    case "gordonmacphail":
      return "ScrapeGordonMacphail";
    case "kilchoman":
      return "ScrapeKilchoman";
    case "northstarspirits":
      return "ScrapeNorthStarSpirits";
    case "reservebar":
      return "ScrapeReserveBar";
    case "singlecasknation":
      return "ScrapeSingleCaskNation";
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

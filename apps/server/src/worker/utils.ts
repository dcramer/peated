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
    case "bruichladdich":
      return "ScrapeBruichladdich";
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
    case "edradour":
      return "ScrapeEdradour";
    case "finedrams":
      return "ScrapeFineDrams";
    case "glenallachie":
      return "ScrapeGlenAllachie";
    case "gordonmacphail":
      return "ScrapeGordonMacphail";
    case "kilchoman":
      return "ScrapeKilchoman";
    case "masterofmalt":
      return "ScrapeMasterOfMalt";
    case "missionliquor":
      return "ScrapeMissionLiquor";
    case "ncnean":
      return "ScrapeNcnean";
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
    case "thompsonbros":
      return "ScrapeThompsonBros";
    case "whiskyadvocate":
      return "ScrapeWhiskyAdvocate";
    case "whiskyworld":
      return "ScrapeWhiskyWorld";
    case "woodencork":
      return "ScrapeWoodenCork";
    case "healthyspirits":
      return "ScrapeHealthySpirits";
    default:
      throw new Error("Unknown site");
  }
}

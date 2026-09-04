import registry from "../registry";
import capturePriceImage from "./capturePriceImage";
import cleanupPendingUploads from "./cleanupPendingUploads";
import createMissingBottles from "./createMissingBottles";
import generateBottleDetails from "./generateBottleDetails";
import generateCountryDetails from "./generateCountryDetails";
import generateEntityDetails from "./generateEntityDetails";
import generateRegionDetails from "./generateRegionDetails";
import geocodeCountryLocation from "./geocodeCountryLocation";
import geocodeEntityLocation from "./geocodeEntityLocation";
import geocodeRegionLocation from "./geocodeRegionLocation";
import indexBottleReference from "./indexBottleReference";
import indexBottleSearchVectors from "./indexBottleSearchVectors";
import indexBottleSeriesSearchVectors from "./indexBottleSeriesSearchVectors";
import indexEntitySearchVectors from "./indexEntitySearchVectors";
import mergeEntity from "./mergeEntity";
import notifyDiscordOnTasting from "./notifyDiscordOnTasting";
import onBottleChange from "./onBottleChange";
import onBottleReferenceChange from "./onBottleReferenceChange";
import onEntityChange from "./onEntityChange";
import processNotification from "./processNotification";
import processStorePriceMatchRetryRun from "./processStorePriceMatchRetryRun";
import reconcileStorePriceMatchProposals from "./reconcileStorePriceMatchProposals";
import repairBottleGroupBottleCounts from "./repairBottleGroupBottleCounts";
import repairBottleSeriesReleaseCounts from "./repairBottleSeriesReleaseCounts";
import repairEntityBottleCounts from "./repairEntityBottleCounts";
import repairLocationBottleCounts from "./repairLocationBottleCounts";
import resolveStorePriceBottle from "./resolveStorePriceBottle";
import runScraper from "./runScraper";
import updateBottleStats from "./updateBottleStats";
import updateCountryStats from "./updateCountryStats";
import updateEntityStats from "./updateEntityStats";
import updateRegionStats from "./updateRegionStats";
import updateSiteReviewScores from "./updateSiteReviewScores";
import verifyBottleCreation from "./verifyBottleCreation";
import verifyEntityCreation from "./verifyEntityCreation";

registry.add("CapturePriceImage", capturePriceImage);
registry.add("CleanupPendingUploads", cleanupPendingUploads);
registry.add("GenerateBottleDetails", generateBottleDetails);
registry.add("GenerateCountryDetails", generateCountryDetails);
registry.add("GenerateEntityDetails", generateEntityDetails);
registry.add("GenerateRegionDetails", generateRegionDetails);
registry.add("GeocodeCountryLocation", geocodeCountryLocation);
registry.add("GeocodeRegionLocation", geocodeRegionLocation);
registry.add("GeocodeEntityLocation", geocodeEntityLocation);
registry.add("IndexBottleReference", indexBottleReference);
registry.add("IndexBottleSearchVectors", indexBottleSearchVectors);
registry.add("IndexBottleSeriesSearchVectors", indexBottleSeriesSearchVectors);
registry.add("IndexEntitySearchVectors", indexEntitySearchVectors);
registry.add("MergeEntity", mergeEntity);
registry.add("NotifyDiscordOnTasting", notifyDiscordOnTasting);
registry.add("OnBottleReferenceChange", onBottleReferenceChange);
registry.add("OnBottleChange", onBottleChange);
registry.add("OnEntityChange", onEntityChange);
registry.add("ProcessNotification", processNotification);
registry.add("ProcessStorePriceMatchRetryRun", processStorePriceMatchRetryRun);
registry.add("RepairBottleGroupBottleCounts", repairBottleGroupBottleCounts);
registry.add(
  "RepairBottleSeriesReleaseCounts",
  repairBottleSeriesReleaseCounts,
);
registry.add("RepairEntityBottleCounts", repairEntityBottleCounts);
registry.add("RepairLocationBottleCounts", repairLocationBottleCounts);
registry.add(
  "ReconcileStorePriceMatchProposals",
  reconcileStorePriceMatchProposals,
);
registry.add("ResolveStorePriceBottle", resolveStorePriceBottle);
registry.add("RunScraper", runScraper, { queueName: "scrapers" });
registry.add("CreateMissingBottles", createMissingBottles);
registry.add("UpdateBottleStats", updateBottleStats);
registry.add("UpdateSiteReviewScores", updateSiteReviewScores);
registry.add("UpdateCountryStats", updateCountryStats);
registry.add("UpdateEntityStats", updateEntityStats);
registry.add("UpdateRegionStats", updateRegionStats);
registry.add("VerifyBottleCreation", verifyBottleCreation);
registry.add("VerifyEntityCreation", verifyEntityCreation);

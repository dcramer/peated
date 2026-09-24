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
import notifyReport from "./notifyReport";
import onBottleChange from "./onBottleChange";
import onBottleReferenceChange from "./onBottleReferenceChange";
import onEntityChange from "./onEntityChange";
import processAccountDeletions from "./processAccountDeletions";
import processNotification from "./processNotification";
import processStorePriceMatchRetryRun from "./processStorePriceMatchRetryRun";
import reconcileStorePriceMatchProposals from "./reconcileStorePriceMatchProposals";
import repairBottleGroupBottleCounts from "./repairBottleGroupBottleCounts";
import repairBottleSeriesReleaseCounts from "./repairBottleSeriesReleaseCounts";
import repairBottleStats from "./repairBottleStats";
import repairCollectionBottleCounts from "./repairCollectionBottleCounts";
import repairEntityBottleCounts from "./repairEntityBottleCounts";
import repairLocationBottleCounts from "./repairLocationBottleCounts";
import resolveStorePriceBottle from "./resolveStorePriceBottle";
import runScraper from "./runScraper";
import updateBottleStats from "./updateBottleStats";
import updateCountryStats from "./updateCountryStats";
import updateEntityStats from "./updateEntityStats";
import updateExternalReviews from "./updateExternalReviews";
import updateRegionStats from "./updateRegionStats";
import updateSiteReviewScores from "./updateSiteReviewScores";
import verifyBottleCreation from "./verifyBottleCreation";
import verifyEntityCreation from "./verifyEntityCreation";

// Worker queue rule: jobs that wait on a hosted model run on the "models"
// queue so fast derived-data work such as search indexing and stats never
// waits behind a classifier call.
registry.add("CapturePriceImage", capturePriceImage);
registry.add("CleanupPendingUploads", cleanupPendingUploads);
registry.add("GenerateBottleDetails", generateBottleDetails, {
  queueName: "models",
});
registry.add("GenerateCountryDetails", generateCountryDetails, {
  queueName: "models",
});
registry.add("GenerateEntityDetails", generateEntityDetails, {
  queueName: "models",
});
registry.add("GenerateRegionDetails", generateRegionDetails, {
  queueName: "models",
});
registry.add("GeocodeCountryLocation", geocodeCountryLocation);
registry.add("GeocodeRegionLocation", geocodeRegionLocation);
registry.add("GeocodeEntityLocation", geocodeEntityLocation);
registry.add("IndexBottleReference", indexBottleReference);
registry.add("IndexBottleSearchVectors", indexBottleSearchVectors);
registry.add("IndexBottleSeriesSearchVectors", indexBottleSeriesSearchVectors);
registry.add("IndexEntitySearchVectors", indexEntitySearchVectors);
registry.add("MergeEntity", mergeEntity);
registry.add("NotifyReport", notifyReport);
registry.add("OnBottleReferenceChange", onBottleReferenceChange);
registry.add("OnBottleChange", onBottleChange);
registry.add("OnEntityChange", onEntityChange);
registry.add("ProcessAccountDeletions", processAccountDeletions);
registry.add("ProcessNotification", processNotification);
registry.add("ProcessStorePriceMatchRetryRun", processStorePriceMatchRetryRun, {
  queueName: "models",
});
registry.add("RepairBottleGroupBottleCounts", repairBottleGroupBottleCounts);
registry.add("RepairBottleStats", repairBottleStats);
registry.add(
  "RepairBottleSeriesReleaseCounts",
  repairBottleSeriesReleaseCounts,
);
registry.add("RepairCollectionBottleCounts", repairCollectionBottleCounts);
registry.add("RepairEntityBottleCounts", repairEntityBottleCounts);
registry.add("RepairLocationBottleCounts", repairLocationBottleCounts);
registry.add(
  "ReconcileStorePriceMatchProposals",
  reconcileStorePriceMatchProposals,
);
registry.add("ResolveStorePriceBottle", resolveStorePriceBottle, {
  queueName: "models",
});
registry.add("RunScraper", runScraper, { queueName: "scrapers" });
registry.add("CreateMissingBottles", createMissingBottles, {
  queueName: "models",
});
registry.add("UpdateBottleStats", updateBottleStats);
registry.add("UpdateSiteReviewScores", updateSiteReviewScores);
registry.add("UpdateCountryStats", updateCountryStats);
registry.add("UpdateEntityStats", updateEntityStats);
registry.add("UpdateExternalReviews", updateExternalReviews);
registry.add("UpdateRegionStats", updateRegionStats);
registry.add("VerifyBottleCreation", verifyBottleCreation, {
  queueName: "models",
});
registry.add("VerifyEntityCreation", verifyEntityCreation, {
  queueName: "models",
});

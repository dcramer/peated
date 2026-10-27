import registry from "../registry";
import applyAuctionLotMatch from "./applyAuctionLotMatch";
import capturePriceImage from "./capturePriceImage";
import cleanupPendingUploads from "./cleanupPendingUploads";
import cleanupWrongPhotoMatchPhotos from "./cleanupWrongPhotoMatchPhotos";
import createMissingBottles from "./createMissingBottles";
import generateCountryDetails from "./generateCountryDetails";
import generateEntityDetails from "./generateEntityDetails";
import generateEntityPronunciationAudio from "./generateEntityPronunciationAudio";
import generateRegionDetails from "./generateRegionDetails";
import geocodeCountryLocation from "./geocodeCountryLocation";
import geocodeEntityLocation from "./geocodeEntityLocation";
import geocodeRegionLocation from "./geocodeRegionLocation";
import identifyTastingDraft from "./identifyTastingDraft";
import indexBottleReference from "./indexBottleReference";
import indexBottleSearch from "./indexBottleSearch";
import indexBottleSeriesSearch from "./indexBottleSeriesSearch";
import indexEntitySearch from "./indexEntitySearch";
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
import resolveAuctionLot from "./resolveAuctionLot";
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
import writeEntityAbout from "./writeEntityAbout";

// Worker queue rule: jobs that wait on a hosted model run on the "models"
// queue so fast derived-data work such as search indexing and stats never
// waits behind a classifier call.
//
// Worker queue rule: `unique: true` marks work keyed by its arguments, such as
// re-indexing or recomputing one record, where only the latest request
// matters. Pushing it again while one is waiting adds nothing. Leave a job
// plain when every push is distinct work or the caller sets its own job ID.
registry.add("CapturePriceImage", capturePriceImage, { unique: true });
registry.add("ApplyAuctionLotMatch", applyAuctionLotMatch, { unique: true });
registry.add("ResolveAuctionLot", resolveAuctionLot, {
  queueName: "models",
  unique: true,
});
registry.add("CleanupPendingUploads", cleanupPendingUploads);
registry.add("CleanupWrongPhotoMatchPhotos", cleanupWrongPhotoMatchPhotos);
registry.add("GenerateCountryDetails", generateCountryDetails, {
  queueName: "models",
});
registry.add("GenerateEntityDetails", generateEntityDetails, {
  queueName: "models",
  unique: true,
});
registry.add("WriteEntityAbout", writeEntityAbout, {
  queueName: "models",
  unique: true,
});
// Pronunciation audio calls Cloud Text-to-Speech, not a model, and every
// request carries a timeout, so it stays on the default queue.
registry.add(
  "GenerateEntityPronunciationAudio",
  generateEntityPronunciationAudio,
  { unique: true },
);
registry.add("GenerateRegionDetails", generateRegionDetails, {
  queueName: "models",
});
registry.add("GeocodeCountryLocation", geocodeCountryLocation);
registry.add("GeocodeRegionLocation", geocodeRegionLocation);
registry.add("GeocodeEntityLocation", geocodeEntityLocation);
registry.add("IdentifyTastingDraft", identifyTastingDraft, {
  queueName: "models",
});
registry.add("IndexBottleReference", indexBottleReference);
registry.add("IndexBottleSearch", indexBottleSearch, { unique: true });
registry.add("IndexBottleSeriesSearch", indexBottleSeriesSearch, {
  unique: true,
});
registry.add("IndexEntitySearch", indexEntitySearch, { unique: true });
registry.add("MergeEntity", mergeEntity);
registry.add("NotifyReport", notifyReport);
registry.add("OnBottleReferenceChange", onBottleReferenceChange, {
  unique: true,
});
registry.add("OnBottleChange", onBottleChange, { unique: true });
registry.add("OnEntityChange", onEntityChange, { unique: true });
registry.add("ProcessAccountDeletions", processAccountDeletions);
registry.add("ProcessNotification", processNotification);
registry.add("ProcessStorePriceMatchRetryRun", processStorePriceMatchRetryRun, {
  queueName: "models",
});
registry.add("RepairBottleGroupBottleCounts", repairBottleGroupBottleCounts, {
  unique: true,
});
registry.add("RepairBottleStats", repairBottleStats, { unique: true });
registry.add(
  "RepairBottleSeriesReleaseCounts",
  repairBottleSeriesReleaseCounts,
  { unique: true },
);
registry.add("RepairCollectionBottleCounts", repairCollectionBottleCounts, {
  unique: true,
});
registry.add("RepairEntityBottleCounts", repairEntityBottleCounts, {
  unique: true,
});
registry.add("RepairLocationBottleCounts", repairLocationBottleCounts, {
  unique: true,
});
registry.add(
  "ReconcileStorePriceMatchProposals",
  reconcileStorePriceMatchProposals,
);
registry.add("ResolveStorePriceBottle", resolveStorePriceBottle, {
  queueName: "models",
  unique: true,
});
registry.add("RunScraper", runScraper, { queueName: "scrapers" });
registry.add("CreateMissingBottles", createMissingBottles, {
  queueName: "models",
  unique: true,
});
registry.add("UpdateBottleStats", updateBottleStats, { unique: true });
registry.add("UpdateSiteReviewScores", updateSiteReviewScores);
registry.add("UpdateCountryStats", updateCountryStats, { unique: true });
registry.add("UpdateEntityStats", updateEntityStats, { unique: true });
registry.add("UpdateExternalReviews", updateExternalReviews, {
  queueName: "models",
  unique: true,
});
registry.add("UpdateRegionStats", updateRegionStats, { unique: true });
registry.add("VerifyBottleCreation", verifyBottleCreation, {
  queueName: "models",
  unique: true,
});
registry.add("VerifyEntityCreation", verifyEntityCreation, {
  queueName: "models",
  unique: true,
});

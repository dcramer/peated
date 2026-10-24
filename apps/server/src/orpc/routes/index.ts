import { api } from "@peated/server/orpc";
import activity from "./activity";
import admin from "./admin";
import ai from "./ai";
import auctions from "./auctions";
import audits from "./audits";
import auth from "./auth";
import badges from "./badges";
import bottleAliases from "./bottleAliases";
import bottleBarcodes from "./bottleBarcodes";
import bottleGroups from "./bottleGroups";
import bottleReferences from "./bottleReferences";
import bottlers from "./bottlers";
import bottles from "./bottles";
import bottleSeries from "./bottleSeries";
import brands from "./brands";
import changes from "./changes";
import collections from "./collections";
import comments from "./comments";
import companies from "./companies";
import countries from "./countries";
import distilleries from "./distilleries";
import email from "./email";
import entities from "./entities";
import events from "./events";
import externalSites from "./external-sites";
import externalReviews from "./externalReviews";
import flights from "./flights";
import friends from "./friends";
import memberReviews from "./memberReviews";
import notifications from "./notifications";
import oauth from "./oauth";
import pendingUploads from "./pendingUploads";
import prices from "./prices";
import regions from "./regions";
import reports from "./reports";
import root from "./root";
import search from "./search";
import smws from "./smws";
import stats from "./stats";
import tags from "./tags";
import tastingDrafts from "./tastingDrafts";
import tastings from "./tastings";
import toasts from "./toasts";
import users from "./users";
import version from "./version";
import wrongPhotoMatches from "./wrongPhotoMatches";

export default api.router({
  activity,
  admin,
  ai,
  audits,
  auctions,
  auth,
  badges,
  bottles,
  bottleAliases,
  bottlers,
  brands,
  bottleReferences,
  bottleBarcodes,
  bottleGroups,
  bottleSeries,
  changes,
  collections,
  comments,
  companies,
  countries,
  distilleries,
  email,
  entities,
  events,
  externalSites,
  flights,
  friends,
  memberReviews,
  smws,
  notifications,
  oauth,
  pendingUploads,
  prices,
  regions,
  reports,
  externalReviews,
  root,
  search,
  stats,
  tags,
  tastingDrafts,
  tastings,
  toasts,
  users,
  version,
  wrongPhotoMatches,
});

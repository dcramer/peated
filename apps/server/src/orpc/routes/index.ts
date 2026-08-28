import { api } from "@peated/server/orpc";
import activity from "./activity";
import admin from "./admin";
import ai from "./ai";
import audits from "./audits";
import auth from "./auth";
import badges from "./badges";
import blenders from "./blenders";
import bottleAliases from "./bottleAliases";
import bottleBarcodes from "./bottleBarcodes";
import bottleGroups from "./bottleGroups";
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
import root from "./root";
import search from "./search";
import smws from "./smws";
import stats from "./stats";
import tags from "./tags";
import tastings from "./tastings";
import toasts from "./toasts";
import users from "./users";
import version from "./version";

export interface Router {
  activity: typeof activity;
  admin: typeof admin;
  ai: typeof ai;
  audits: typeof audits;
  auth: typeof auth;
  badges: typeof badges;
  blenders: typeof blenders;
  bottles: typeof bottles;
  bottlers: typeof bottlers;
  brands: typeof brands;
  bottleAliases: typeof bottleAliases;
  bottleBarcodes: typeof bottleBarcodes;
  bottleGroups: typeof bottleGroups;
  bottleSeries: typeof bottleSeries;
  changes: typeof changes;
  collections: typeof collections;
  comments: typeof comments;
  companies: typeof companies;
  countries: typeof countries;
  distilleries: typeof distilleries;
  email: typeof email;
  entities: typeof entities;
  events: typeof events;
  externalSites: typeof externalSites;
  flights: typeof flights;
  friends: typeof friends;
  memberReviews: typeof memberReviews;
  notifications: typeof notifications;
  oauth: typeof oauth;
  pendingUploads: typeof pendingUploads;
  prices: typeof prices;
  regions: typeof regions;
  externalReviews: typeof externalReviews;
  root: typeof root;
  search: typeof search;
  smws: typeof smws;
  stats: typeof stats;
  tags: typeof tags;
  tastings: typeof tastings;
  toasts: typeof toasts;
  users: typeof users;
  version: typeof version;
}

export default api.router({
  activity,
  admin,
  ai,
  audits,
  auth,
  badges,
  blenders,
  bottles,
  bottlers,
  brands,
  bottleAliases,
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
  externalReviews,
  root,
  search,
  stats,
  tags,
  tastings,
  toasts,
  users,
  version,
});

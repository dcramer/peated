import activity from "./activity";
import admin from "./admin";
import ai from "./ai";
import audits from "./audits";
import auth from "./auth";
import badges from "./badges";
import bottleAliases from "./bottleAliases";
import bottleBarcodes from "./bottleBarcodes";
import bottleGroups from "./bottleGroups";
import bottles from "./bottles";
import bottleSeries from "./bottleSeries";
import changes from "./changes";
import collections from "./collections";
import comments from "./comments";
import countries from "./countries";
import email from "./email";
import entities from "./entities";
import events from "./events";
import externalSites from "./external-sites";
import flights from "./flights";
import friends from "./friends";
import notifications from "./notifications";
import oauth from "./oauth";
import pendingUploads from "./pendingUploads";
import prices from "./prices";
import regions from "./regions";
import reviews from "./reviews";
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
  bottles: typeof bottles;
  bottleAliases: typeof bottleAliases;
  bottleBarcodes: typeof bottleBarcodes;
  bottleGroups: typeof bottleGroups;
  bottleSeries: typeof bottleSeries;
  changes: typeof changes;
  collections: typeof collections;
  comments: typeof comments;
  countries: typeof countries;
  email: typeof email;
  entities: typeof entities;
  events: typeof events;
  externalSites: typeof externalSites;
  flights: typeof flights;
  friends: typeof friends;
  notifications: typeof notifications;
  oauth: typeof oauth;
  pendingUploads: typeof pendingUploads;
  prices: typeof prices;
  regions: typeof regions;
  reviews: typeof reviews;
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

export default {
  activity,
  admin,
  ai,
  audits,
  auth,
  badges,
  bottles,
  bottleAliases,
  bottleBarcodes,
  bottleGroups,
  bottleSeries,
  changes,
  collections,
  comments,
  countries,
  email,
  entities,
  events,
  externalSites,
  flights,
  friends,
  smws,
  notifications,
  oauth,
  pendingUploads,
  prices,
  regions,
  reviews,
  root,
  search,
  stats,
  tags,
  tastings,
  toasts,
  users,
  version,
};

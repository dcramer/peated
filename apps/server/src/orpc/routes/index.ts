import admin from "./admin";
import ai from "./ai";
import auth from "./auth";
import badges from "./badges";
import bottleAliases from "./bottleAliases";
import bottleReleases from "./bottleReleases";
import bottleSeries from "./bottleSeries";
import bottles from "./bottles";
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
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  badges: typeof badges;
  bottles: typeof bottles;
  bottleAliases: typeof bottleAliases;
  bottleReleases: typeof bottleReleases;
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
  admin,
  ai,
  auth,
  badges,
  bottles,
  bottleAliases,
  bottleReleases,
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

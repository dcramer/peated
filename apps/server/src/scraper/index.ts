/**
 * Public boundary for the isolated scraper runtime. Code outside this module
 * should depend on these contracts, not coordinator, HTTP, robots, or adapter
 * implementation details.
 */
export {
  ScraperCoordinationError,
  acquireScrapePermit,
  recordScrapeRateLimit,
  releaseScrapePermit,
} from "./coordinator";
export type { PermitDenialReason, PermitResult } from "./coordinator";
export {
  DEFAULT_SCRAPER_REQUEST_POLICY,
  createScraperRegistry,
  defineScrapeTarget,
  defineScraperSource,
  findScraperSourceBySiteType,
  resolveScraperOrigin,
} from "./definitions";
export {
  ScraperHttpStatusError,
  ScraperRequestDeferredError,
  ScraperRequestError,
  parseRetryAfter,
  requestScraperUrl,
  scraperSystemClock,
} from "./http";
export type {
  ScraperDeferralReason,
  ScraperHttpClock,
  ScraperRequestErrorCategory,
} from "./http";
export {
  ScraperRobotsDeniedError,
  ensureRobotsAllowed,
  parseRobotsRules,
  robotsAllowsUrl,
} from "./robots";
export { executeScraperRun } from "./runs";
export type { ScraperRunExecutionResult } from "./runs";
export { ScraperRunOwnershipError, createScraperSession } from "./session";
export { syncScraperDefinitions } from "./syncDefinitions";
export type {
  RobotsPolicy,
  ScrapeOriginDefinition,
  ScrapeTargetDefinition,
  ScraperAdapter,
  ScraperAuthorization,
  ScraperObservation,
  ScraperRegistry,
  ScraperRequest,
  ScraperResponse,
  ScraperSession,
  ScraperSink,
  ScraperSourceDefinition,
} from "./types";

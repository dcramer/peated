// A worker extends its run timeout every 15 minutes. Both the database timeout
// and the queue job lock last one hour.
export const SCRAPER_RUN_TIMEOUT_MS = 60 * 60_000;
export const SCRAPER_RUN_REFRESH_MS = 15 * 60_000;
export const SCRAPER_JOB_LOCK_MS = 60 * 60_000;

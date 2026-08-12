import type { ExternalSiteType } from "@peated/server/types";

export class ExternalSiteNotFoundError extends Error {
  constructor(readonly site: ExternalSiteType) {
    super(`External site not found: ${site}`);
    this.name = "ExternalSiteNotFoundError";
  }
}

import { configureLogging } from "@peated/server/lib/log";

/** Configure logging with CLI-owned root metadata before commands run. */
export function configureCliLogging(): void {
  configureLogging({
    rootCategory: ["peated", "cli"],
  });
}

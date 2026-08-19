import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { LegacyBottleObservation } from "../adapters/legacyBottle";
import type { ScraperSession } from "../types";
import { runLegacyRequestContext } from "./requestContext";

const legacyBottleStorage = new AsyncLocalStorage<{
  session: ScraperSession<null, LegacyBottleObservation>;
}>();

export async function runLegacyBottleAdapter<T>({
  session,
  targetKey,
  run,
}: {
  session: ScraperSession<null, LegacyBottleObservation>;
  targetKey: string;
  run: () => Promise<T>;
}) {
  return await runLegacyRequestContext({
    session,
    targetKey,
    run: async () => await legacyBottleStorage.run({ session }, run),
  });
}

export async function emitLegacyBottleObservation(
  observation: LegacyBottleObservation,
) {
  const context = legacyBottleStorage.getStore();
  if (!context) return false;
  const sourceKey = createHash("sha256")
    .update(
      observation.price?.url ??
        JSON.stringify({
          name: observation.bottle.name,
          brand: observation.bottle.brand,
          bottler: observation.bottle.bottler,
        }),
    )
    .digest("hex");
  await context.session.emit({ sourceKey, value: observation });
  return true;
}

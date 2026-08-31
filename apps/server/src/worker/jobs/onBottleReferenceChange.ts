import { syncBottleReferenceConsumersForReferenceChange } from "@peated/server/lib/bottleReferences";
import { runJob } from "@peated/server/worker/client";
import { z } from "zod";
import type { JobPayload } from "../types";

/** Synchronizes unresolved direct-Bottle consumers before refreshing reference search. */
export const OnBottleReferenceChangeJobArgsSchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

export type OnBottleReferenceChangeServices = {
  runReferenceIndex: (name: string) => Promise<void>;
};

const defaultServices: OnBottleReferenceChangeServices = {
  runReferenceIndex: async (name) => {
    await runJob("IndexBottleReference", { name });
  },
};

export async function onBottleReferenceChange(
  input: JobPayload,
  services: OnBottleReferenceChangeServices = defaultServices,
) {
  const { name } = OnBottleReferenceChangeJobArgsSchema.parse(input);

  await syncBottleReferenceConsumersForReferenceChange(name);

  await services.runReferenceIndex(name);
}

export default async function onBottleReferenceChangeJob(input: JobPayload) {
  return await onBottleReferenceChange(input);
}

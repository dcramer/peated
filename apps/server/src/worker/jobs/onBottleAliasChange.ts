import { syncBottleAliasConsumersForAliasChange } from "@peated/server/lib/bottleAliases";
import { runJob } from "@peated/server/worker/client";
import { z } from "zod";
import type { JobPayload } from "../types";

/** Synchronizes unresolved direct-Bottle consumers before refreshing alias search. */
export const OnBottleAliasChangeJobArgsSchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

export type OnBottleAliasChangeServices = {
  runAliasIndex: (name: string) => Promise<void>;
};

const defaultServices: OnBottleAliasChangeServices = {
  runAliasIndex: async (name) => {
    await runJob("IndexBottleAlias", { name });
  },
};

export async function onBottleAliasChange(
  input: JobPayload,
  services: OnBottleAliasChangeServices = defaultServices,
) {
  const { name } = OnBottleAliasChangeJobArgsSchema.parse(input);

  await syncBottleAliasConsumersForAliasChange(name);

  await services.runAliasIndex(name);
}

export default async function onBottleAliasChangeJob(input: JobPayload) {
  return await onBottleAliasChange(input);
}

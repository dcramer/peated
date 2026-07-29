import { syncBottleAliasConsumersForAliasChange } from "@peated/server/lib/bottleAliases";
import { runJob } from "@peated/server/worker/client";
import { z } from "zod";

/** Synchronizes unresolved direct-Bottle consumers before refreshing alias search. */
export const OnBottleAliasChangeJobArgsSchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

export default async function onBottleAliasChange(input: unknown) {
  const { name } = OnBottleAliasChangeJobArgsSchema.parse(input);

  await syncBottleAliasConsumersForAliasChange(name);

  await runJob("IndexBottleAlias", { name });
}

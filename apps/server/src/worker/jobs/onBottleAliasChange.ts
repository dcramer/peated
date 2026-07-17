import { syncBottleAliasConsumersForAliasChange } from "@peated/server/lib/bottleAliases";
import { runJob } from "@peated/server/worker/client";

/** Synchronizes eligible legacy alias consumers before refreshing alias search. */
export default async ({ name }: { name: string }) => {
  await syncBottleAliasConsumersForAliasChange(name);

  await runJob("IndexBottleAlias", { name });
};

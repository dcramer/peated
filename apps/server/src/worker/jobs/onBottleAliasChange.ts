import { syncBottleAliasConsumersForAliasChange } from "@peated/server/lib/bottleAliases";
import { runJob } from "@peated/server/worker/client";

/** Synchronizes unresolved direct-Bottle consumers before refreshing alias search. */
export default async ({ name }: { name: string }) => {
  await syncBottleAliasConsumersForAliasChange(name);

  await runJob("IndexBottleAlias", { name });
};

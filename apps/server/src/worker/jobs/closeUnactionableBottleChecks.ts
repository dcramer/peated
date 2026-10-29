import { closeUnactionableBottleChecks } from "@peated/server/lib/unactionableBottleChecks";

export default async function closeUnactionableBottleChecksJob() {
  await closeUnactionableBottleChecks();
}

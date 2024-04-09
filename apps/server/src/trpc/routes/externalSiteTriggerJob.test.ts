import * as jobs from "@peated/server/jobs/client";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(caller.externalSiteTriggerJob(site.type));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("triggers job", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const newSite = await caller.externalSiteTriggerJob(site.type);
  expect(newSite.lastRunAt).toBeTruthy();
  expect(new Date(newSite.lastRunAt || "").getTime()).toBeGreaterThan(
    new Date().getTime() - 5000,
  );

  expect(jobs.pushJob).toHaveBeenCalledOnce();
});

import * as jobs from "@peated/server/jobs/client";
import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("requires admin", async () => {
  const site = await Fixtures.ExternalSite({ type: "whiskyadvocate" });
  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  expect(() => caller.externalSiteTriggerJob(site.type)).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
});

test("triggers job", async () => {
  const site = await Fixtures.ExternalSite({ type: "whiskyadvocate" });
  const caller = createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const newSite = await caller.externalSiteTriggerJob(site.type);
  expect(newSite.lastRunAt).toBeTruthy();
  expect(new Date(newSite.lastRunAt || "").getTime()).toBeGreaterThan(
    new Date().getTime() - 5000,
  );

  expect(jobs.pushJob).toHaveBeenCalledOnce();
});

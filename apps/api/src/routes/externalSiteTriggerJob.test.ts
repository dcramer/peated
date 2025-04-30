import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/worker/client";
import { createCaller } from "../trpc/router";

vi.mock("@peated/server/worker/client");

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

  expect(pushJob).toHaveBeenCalledOnce();
});

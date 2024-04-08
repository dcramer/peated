import { db } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(
    caller.externalSiteConfigGet({
      site: site.type,
      key: "test",
    }),
  );
  expect(err).toMatchInlineSnapshot();
});

test("get missing value", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const data = await caller.externalSiteConfigGet({
    site: site.type,
    key: "test",
  });
  expect(data).toBeNull();
});

test("get missing value with default", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const data = await caller.externalSiteConfigGet({
    site: site.type,
    key: "test",
    default: [],
  });
  expect(data).toEqual([]);
});

test("get present value", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  await db.insert(externalSiteConfig).values({
    externalSiteId: site.id,
    key: "test",
    value: { foo: "bar" },
  });

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const data = await caller.externalSiteConfigGet({
    site: site.type,
    key: "test",
  });
  expect(data).toEqual({ foo: "bar" });
});

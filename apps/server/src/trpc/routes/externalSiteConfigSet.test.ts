import { db } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.externalSiteConfigSet({
      site: site.type,
      key: "test",
      value: "test",
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("set new value", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  await caller.externalSiteConfigSet({
    site: site.type,
    key: "test",
    value: "bar",
  });
  const results = await db
    .select()
    .from(externalSiteConfig)
    .where(eq(externalSiteConfig.externalSiteId, site.id));
  expect(results.length).toEqual(1);
  expect(results[0].key).toEqual("test");
  expect(results[0].value).toEqual("bar");
});

test("set existing value", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  await db.insert(externalSiteConfig).values({
    externalSiteId: site.id,
    key: "test",
    value: { foo: "bar" },
  });

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  await caller.externalSiteConfigSet({
    site: site.type,
    key: "test",
    value: "bar",
  });
  const results = await db
    .select()
    .from(externalSiteConfig)
    .where(eq(externalSiteConfig.externalSiteId, site.id));
  expect(results.length).toEqual(1);
  expect(results[0].key).toEqual("test");
  expect(results[0].value).toEqual("bar");
});

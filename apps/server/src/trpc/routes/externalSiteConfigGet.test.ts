import { db } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires admin", async () => {
  const site = await Fixtures.ExternalSite();
  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  expect(() =>
    caller.externalSiteConfigGet({
      site: site.type,
      key: "test",
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("get missing value", async () => {
  const site = await Fixtures.ExternalSite();

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const data = await caller.externalSiteConfigGet({
    site: site.type,
    key: "test",
  });
  expect(data).toBeNull();
});

test("get missing value with default", async () => {
  const site = await Fixtures.ExternalSite();

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const data = await caller.externalSiteConfigGet({
    site: site.type,
    key: "test",
    default: [],
  });
  expect(data).toEqual([]);
});

test("get present value", async () => {
  const site = await Fixtures.ExternalSite();
  await db.insert(externalSiteConfig).values({
    externalSiteId: site.id,
    key: "test",
    value: { foo: "bar" },
  });

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ admin: true }),
  });
  const data = await caller.externalSiteConfigGet({
    site: site.type,
    key: "test",
  });
  expect(data).toEqual({ foo: "bar" });
});

import { createCaller } from "../router";

test("lists editions", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const edition1 = await fixtures.BottleEdition({
    bottleId: bottle.id,
    name: "Edition 1",
    releaseYear: 2020,
  });
  const edition2 = await fixtures.BottleEdition({
    bottleId: bottle.id,
    name: "Edition 2",
    releaseYear: 2021,
  });
  // Create an edition for a different bottle to ensure filtering works
  await fixtures.BottleEdition({
    bottleId: (await fixtures.Bottle()).id,
    name: "Other Edition",
  });

  const caller = createCaller({ user: null });
  const { results, rel } = await caller.bottleEditionList({
    bottle: bottle.id,
  });

  expect(results).toHaveLength(2);
  expect(results[0].id).toEqual(edition1.id);
  expect(results[1].id).toEqual(edition2.id);
  expect(results[0].name).toEqual("Edition 1");
  expect(results[1].name).toEqual("Edition 2");
  expect(rel.nextCursor).toBeNull();
  expect(rel.prevCursor).toBeNull();
});

test("returns not found for invalid bottle", async () => {
  const caller = createCaller({ user: null });
  await expect(
    caller.bottleEditionList({
      bottle: 12345,
    }),
  ).rejects.toThrowError("Bottle not found.");
});

test("paginates results", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const edition1 = await fixtures.BottleEdition({
    bottleId: bottle.id,
    name: "Edition 1",
    releaseYear: 2020,
  });
  const edition2 = await fixtures.BottleEdition({
    bottleId: bottle.id,
    name: "Edition 2",
    releaseYear: 2021,
  });

  const caller = createCaller({ user: null });
  const { results, rel } = await caller.bottleEditionList({
    bottle: bottle.id,
    cursor: 2,
    limit: 1,
  });

  expect(results).toHaveLength(1);
  expect(results[0].id).toEqual(edition2.id);
  expect(rel.nextCursor).toBeNull();
  expect(rel.prevCursor).toBe(1);
});

test("handles next cursor", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const edition1 = await fixtures.BottleEdition({
    bottleId: bottle.id,
    name: "Edition 1",
    releaseYear: 2020,
  });
  const edition2 = await fixtures.BottleEdition({
    bottleId: bottle.id,
    name: "Edition 2",
    releaseYear: 2021,
  });

  const caller = createCaller({ user: null });
  const { results, rel } = await caller.bottleEditionList({
    bottle: bottle.id,
    cursor: 1,
    limit: 1,
  });

  expect(results).toHaveLength(1);
  expect(results[0].id).toEqual(edition1.id);
  expect(rel.nextCursor).toBe(2);
  expect(rel.prevCursor).toBeNull();
});

import type { User } from "@peated/server/db/schema";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

let groupSequence = 0;

async function createTwoMemberGroup({
  mod,
  fixtures,
}: {
  mod: User;
  fixtures: {
    Entity: (data?: Record<string, unknown>) => Promise<{ id: number }>;
  };
}) {
  groupSequence += 1;
  const brand = await fixtures.Entity({
    name: `Route Split Brand ${groupSequence}`,
  });
  const context = { user: mod } as Parameters<
    typeof createConcreteBottle
  >[0]["context"];
  const first = await createConcreteBottle({
    context,
    input: {
      kind: "independent",
      stable: { name: `Route Split Group ${groupSequence}`, brand: brand.id },
      exact: { edition: "First" },
    },
  });
  const second = await createConcreteBottle({
    context,
    input: {
      kind: "source_bottle",
      sourceBottleId: first.bottle.id,
      exact: { edition: "Second" },
    },
  });
  return { first, second };
}

describe("POST /bottle-groups/:group/split", () => {
  test("requires moderator access before handling the split", async ({
    defaults,
  }) => {
    const input = {
      group: 1,
      movedBottleIds: [2],
      newRepresentativeBottleId: 2,
    };
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        routerClient.bottleGroups.split(input, { context: { user } }),
      );
      expect(error).toMatchObject({ status: 401 });
    }
  });

  test("strictly validates the split contract", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });

    await expect(
      routerClient.bottleGroups.split(
        {
          group: 1,
          movedBottleIds: [2, 2],
          newRepresentativeBottleId: 2,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      routerClient.bottleGroups.split(
        {
          group: 1,
          movedBottleIds: [2],
          newRepresentativeBottleId: 2,
          // @ts-expect-error exercising runtime validation for malformed clients
          unexpected: true,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("returns the strict result for a committed split", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first, second } = await createTwoMemberGroup({ mod, fixtures });

    const result = await routerClient.bottleGroups.split(
      {
        group: first.group.id,
        movedBottleIds: [second.bottle.id],
        newRepresentativeBottleId: second.bottle.id,
      },
      { context: { user: mod } },
    );

    expect(result).toEqual({
      sourceGroupId: first.group.id,
      newGroupId: expect.any(Number),
      movedBottleIds: [second.bottle.id],
      sourceRepresentativeBottleId: first.bottle.id,
      newRepresentativeBottleId: second.bottle.id,
    });
  });

  test("maps missing source/member groups and membership conflicts", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first, second } = await createTwoMemberGroup({ mod, fixtures });
    const foreign = await fixtures.Bottle({ name: "Route Split Foreign" });

    await expect(
      routerClient.bottleGroups.split(
        {
          group: 999_999,
          movedBottleIds: [second.bottle.id],
          newRepresentativeBottleId: second.bottle.id,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      routerClient.bottleGroups.split(
        {
          group: first.group.id,
          movedBottleIds: [999_999],
          newRepresentativeBottleId: 999_999,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      routerClient.bottleGroups.split(
        {
          group: first.group.id,
          movedBottleIds: [foreign.id],
          newRepresentativeBottleId: foreign.id,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      routerClient.bottleGroups.split(
        {
          group: first.group.id,
          movedBottleIds: [first.bottle.id, second.bottle.id],
          newRepresentativeBottleId: second.bottle.id,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

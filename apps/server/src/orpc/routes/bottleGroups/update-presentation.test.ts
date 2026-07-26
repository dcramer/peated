import { db } from "@peated/server/db";
import { bottleGroups, type User } from "@peated/server/db/schema";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

let groupSequence = 0;

async function createTwoMemberGroup({
  mod,
  fixtures,
}: {
  mod: User;
  fixtures: Pick<typeof Fixtures, "BottleGroupMember" | "Entity">;
}) {
  groupSequence += 1;
  const brand = await fixtures.Entity({
    name: `Route Presentation Brand ${groupSequence}`,
  });
  const context = { user: mod } as Parameters<
    typeof createConcreteBottle
  >[0]["context"];
  const first = await createConcreteBottle({
    context,
    input: {
      stable: {
        name: `Route Presentation Group ${groupSequence}`,
        brand: brand.id,
      },
      exact: { edition: "First" },
    },
  });
  const second = {
    bottle: await fixtures.BottleGroupMember({
      groupId: first.group.id,
      edition: "Second",
    }),
  };
  return { first, second };
}

describe("PATCH /bottle-groups/:group/presentation", () => {
  test("requires moderator access before handling presentation", async ({
    defaults,
  }) => {
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        routerClient.bottleGroups.updatePresentation(
          { group: 1, description: "Unauthorized" },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ status: 401 });
    }
  });

  test("strictly limits input to group-owned presentation fields", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    await expect(
      routerClient.bottleGroups.updatePresentation(
        // @ts-expect-error exercising runtime validation for malformed clients
        { group: 1, name: "Shared identity is not presentation" },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      routerClient.bottleGroups.updatePresentation(
        { group: 1, imageUrl: "not-a-url" },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("returns minimal changed results for no-op and persisted updates", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first, second } = await createTwoMemberGroup({ mod, fixtures });

    await expect(
      routerClient.bottleGroups.updatePresentation(
        { group: first.group.id },
        { context: { user: mod } },
      ),
    ).resolves.toEqual({ changed: false });
    await expect(
      routerClient.bottleGroups.updatePresentation(
        {
          group: first.group.id,
          representativeBottleId: second.bottle.id,
          description: "Group-owned route editorial",
          descriptionSrc: "user",
        },
        { context: { user: mod } },
      ),
    ).resolves.toEqual({ changed: true });

    await expect(
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.group.id),
      }),
    ).resolves.toMatchObject({
      representativeBottleId: second.bottle.id,
      description: "Group-owned route editorial",
      descriptionSrc: "user",
    });
  });

  test("maps missing groups/representatives and membership conflicts", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const { first } = await createTwoMemberGroup({ mod, fixtures });
    const foreign = await fixtures.Bottle({
      name: "Route Presentation Foreign",
    });

    await expect(
      routerClient.bottleGroups.updatePresentation(
        { group: 999_999, description: "Missing" },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      routerClient.bottleGroups.updatePresentation(
        { group: first.group.id, representativeBottleId: 999_999 },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      routerClient.bottleGroups.updatePresentation(
        { group: first.group.id, representativeBottleId: foreign.id },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

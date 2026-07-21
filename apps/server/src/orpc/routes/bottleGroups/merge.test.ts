import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /bottle-groups/:group/merge-targets", () => {
  test("requires moderator access before handling the merge", async ({
    defaults,
  }) => {
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        routerClient.bottleGroups.merge(
          { group: 1, destinationGroupId: 2 },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ status: 401 });
    }
  });

  test("strictly validates the source and destination IDs", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    await expect(
      routerClient.bottleGroups.merge(
        // @ts-expect-error exercising runtime validation for malformed clients
        { group: 1, destinationGroupId: 2, unexpected: true },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      routerClient.bottleGroups.merge(
        { group: 0, destinationGroupId: 2 },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("returns the strict service result and an inert result on retry", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const source = await fixtures.Bottle({
      name: "Route Merge Source",
      edition: "Source Edition",
    });
    const destination = await fixtures.Bottle({
      name: "Route Merge Destination",
      edition: "Destination Edition",
    });
    const input = {
      group: source.groupId!,
      destinationGroupId: destination.groupId!,
    };

    const result = await routerClient.bottleGroups.merge(input, {
      context: { user: mod },
    });
    expect(result).toEqual({
      sourceGroupId: source.groupId,
      destinationGroupId: destination.groupId,
      changed: true,
      movedBottleIds: [source.id],
    });

    await expect(
      routerClient.bottleGroups.merge(input, { context: { user: mod } }),
    ).resolves.toEqual({
      sourceGroupId: source.groupId,
      destinationGroupId: destination.groupId,
      changed: false,
      movedBottleIds: [],
    });
  });

  test("maps same-group, missing, and retired/conflicting groups", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const source = await fixtures.Bottle({
      name: "Route Merge Retired",
      edition: "Retired Source Edition",
    });
    const destination = await fixtures.Bottle({
      name: "Route Merge First Destination",
      edition: "First Destination Edition",
    });
    const otherDestination = await fixtures.Bottle({
      name: "Route Merge Other Destination",
      edition: "Other Destination Edition",
    });

    await expect(
      routerClient.bottleGroups.merge(
        {
          group: destination.groupId!,
          destinationGroupId: destination.groupId!,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      routerClient.bottleGroups.merge(
        { group: 999_999, destinationGroupId: destination.groupId! },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 404 });

    await routerClient.bottleGroups.merge(
      {
        group: source.groupId!,
        destinationGroupId: destination.groupId!,
      },
      { context: { user: mod } },
    );
    await expect(
      routerClient.bottleGroups.merge(
        {
          group: source.groupId!,
          destinationGroupId: otherDestination.groupId!,
        },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

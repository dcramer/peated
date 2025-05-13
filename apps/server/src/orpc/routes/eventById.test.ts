import { db } from "@peated/server/db";
import { entityTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "../router";

describe("GET /events/:id", () => {
  test("returns event details", async ({ fixtures }) => {
    const event = await fixtures.Event();

    const data = await routerClient.eventById({
      id: event.id,
    });

    expect(data.id).toEqual(event.id);
    expect(data.name).toEqual(event.name);
  });

  test("returns 404 for invalid event", async () => {
    const err = await waitError(
      routerClient.eventById({
        id: 12345,
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });
});

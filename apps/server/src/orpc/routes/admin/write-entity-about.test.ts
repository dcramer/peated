import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /admin/catalog/write-entity-about", () => {
  test("needs an entity for a dry run", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    const error = await waitError(() =>
      routerClient.admin.writeEntityAbout(
        { dryRun: true },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});

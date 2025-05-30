import config from "@peated/server/config";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import path from "path";
import sharp from "sharp";

describe("POST /bottles/:bottle/image", () => {
  test("cannot update another user's bottle", async ({ fixtures }) => {
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const bottle = await fixtures.Bottle({ createdById: otherUser.id });

    const err = await waitError(
      routerClient.bottles.imageUpdate(
        {
          bottle: bottle.id,
          file: await fixtures.SampleSquareImage(),
        },
        {
          context: { user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You don't have permission to update this bottle.]`,
    );
  });

  test("bottle image does resize down", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle({
      createdById: defaults.user.id,
    });

    const response = await routerClient.bottles.imageUpdate(
      {
        bottle: bottle.id,
        file: await fixtures.SampleSquareImage(),
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.imageUrl).toBeDefined();
    expect(path.extname(response.imageUrl)).toBe(".webp");

    // Verify the image was resized correctly
    const filepath = `${config.UPLOAD_PATH}/${path.basename(response.imageUrl)}`;
    const metadata = await sharp(filepath).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.height).toBeLessThanOrEqual(1024);
    expect(metadata.width).toBeLessThanOrEqual(1024);
  });
});

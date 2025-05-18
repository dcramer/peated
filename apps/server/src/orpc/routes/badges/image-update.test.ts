import config from "@peated/server/config";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import path from "path";
import sharp from "sharp";

describe("POST /badges/:badge/image", () => {
  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true, admin: false });
    const badge = await fixtures.Badge();

    const err = await waitError(
      routerClient.badges.imageUpdate(
        {
          badge: badge.id,
          file: await fixtures.SampleSquareImage(),
        },
        {
          context: { user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("badge image does resize down", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const badge = await fixtures.Badge();

    const response = await routerClient.badges.imageUpdate(
      {
        badge: badge.id,
        file: await fixtures.SampleSquareImage(),
      },
      {
        context: { user },
      },
    );

    expect(response.imageUrl).toBeDefined();
    expect(path.extname(response.imageUrl)).toBe(".webp");

    // Verify the image was resized correctly
    const filepath = `${config.UPLOAD_PATH}/${path.basename(response.imageUrl)}`;
    const metadata = await sharp(filepath).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(500);
    expect(metadata.height).toBe(500);
  });
});

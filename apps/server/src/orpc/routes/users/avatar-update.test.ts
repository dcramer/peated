import config from "@peated/server/config";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import path from "path";
import sharp from "sharp";

describe("POST /users/:user/avatar", () => {
  test("cannot update another user's avatar", async ({ fixtures }) => {
    const user = await fixtures.User();
    const otherUser = await fixtures.User();

    const err = await waitError(
      routerClient.users.avatarUpdate(
        {
          user: otherUser.id,
          file: await fixtures.SampleSquareImage(),
        },
        {
          context: { user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot update another user's avatar.]`,
    );
  });

  test("can use 'me' as user ID", async ({ fixtures, defaults }) => {
    const response = await routerClient.users.avatarUpdate(
      {
        user: "me",
        file: await fixtures.SampleSquareImage(),
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.pictureUrl).toBeDefined();
    expect(path.extname(response.pictureUrl)).toBe(".webp");

    // Verify the image was resized correctly
    const filepath = `${config.UPLOAD_PATH}/${path.basename(response.pictureUrl)}`;
    const metadata = await sharp(filepath).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.height).toBeLessThanOrEqual(500);
    expect(metadata.width).toBeLessThanOrEqual(500);
  });
});

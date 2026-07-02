import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { compressAndResizeImage } from "./uploads";

function createGradientPixels(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      pixels[offset] = (x * 3 + y * 5) % 256;
      pixels[offset + 1] = (x * 7 + y * 11) % 256;
      pixels[offset + 2] = (x * 13 + y * 17) % 256;
    }
  }

  return pixels;
}

describe("compressAndResizeImage", () => {
  test("bakes EXIF orientation into the stored WebP", async () => {
    const input = await sharp(createGradientPixels(80, 40), {
      raw: {
        width: 80,
        height: 40,
        channels: 3,
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    expect((await sharp(input).metadata()).orientation).toBe(6);

    const { stream, filename } = compressAndResizeImage(
      Readable.from(input),
      "phone-photo.jpg",
      1600,
      1600,
    );
    const output = await buffer(stream);
    const metadata = await sharp(output).metadata();

    expect(filename).toBe("phone-photo.webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(40);
    expect(metadata.height).toBe(80);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });
});

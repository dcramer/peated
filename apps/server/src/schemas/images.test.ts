import { ImageSourceUrlSchema } from "./images";

describe("ImageSourceUrlSchema", () => {
  test.each(["https://example.com/image", "http://example.com/image"])(
    "accepts %s",
    (sourceUrl) => {
      expect(ImageSourceUrlSchema.parse(sourceUrl)).toBe(sourceUrl);
    },
  );

  test.each(["javascript:alert(1)", "data:text/plain,image"])(
    "rejects %s",
    (sourceUrl) => {
      expect(() => ImageSourceUrlSchema.parse(sourceUrl)).toThrow(
        "Enter an HTTP or HTTPS URL.",
      );
    },
  );
});

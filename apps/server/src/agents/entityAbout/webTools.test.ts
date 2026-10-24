import { toPlainText } from "./webTools";

describe("toPlainText", () => {
  test("keeps link text and drops images", () => {
    expect(
      toPlainText(
        '![Still house](https://example.com/a.jpg)[Brora](https://en.wikipedia.org/wiki/Brora_(distillery)) was founded in 1819 by the [Marquess of Stafford](/wiki/Marquess "title").',
      ),
    ).toBe("Brora was founded in 1819 by the Marquess of Stafford.");
  });
});

import { findInPages, toPlainText } from "./webTools";

describe("toPlainText", () => {
  test("keeps link text and drops images", () => {
    expect(
      toPlainText(
        '![Still house](https://example.com/a.jpg)[Brora](https://en.wikipedia.org/wiki/Brora_(distillery)) was founded in 1819 by the [Marquess of Stafford](/wiki/Marquess "title").',
      ),
    ).toBe("Brora was founded in 1819 by the Marquess of Stafford.");
  });
});

describe("findInPages", () => {
  const pages = [
    {
      url: "https://example.com/a",
      text: "The distillery was bought by Seager Evans in 1962. Later, Seager Evans finished the purchase.",
    },
    {
      url: "https://example.com/b",
      text: "seager evans completed it in 1967.",
    },
    { url: "https://example.com/c", text: "Nothing about owners here." },
  ];

  test("finds every passage on every page, ignoring case", () => {
    const matches = findInPages(pages, "Seager Evans");

    expect(matches.map(({ url }) => url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(matches[0]?.passage).toContain("1962");
    expect(matches[1]?.passage).toContain("1967");
  });

  test("matches across line breaks", () => {
    const matches = findInPages(
      [
        {
          url: "https://example.com/d",
          text: "Bought by Seager\nEvans in 1962.",
        },
      ],
      "seager evans",
    );

    expect(matches[0]?.passage).toBe("Bought by Seager Evans in 1962.");
  });

  test("returns nothing when no page has the text", () => {
    expect(findInPages(pages, "Allied Lyons")).toEqual([]);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TastingEntry } from "./tastingEntry.stylex";

function renderNotes(notes: string, notesHref?: string) {
  return renderToStaticMarkup(
    <TastingEntry
      author="peatfan"
      date="Today"
      members={[
        {
          name: "Lagavulin 16-year-old",
          notes,
          notesHref,
        },
      ]}
    />,
  );
}

describe("TastingEntry notes", () => {
  it("shows short tasting notes without a details link", () => {
    const html = renderNotes("Smoke, fruit, and sea salt.", "/tastings/1");

    expect(html).toContain("Smoke, fruit, and sea salt.");
    expect(html).not.toContain("Read more");
  });

  it("shortens long tasting notes and links to the tasting details", () => {
    const html = renderNotes(
      `${"Smoke, fruit, and sea salt. ".repeat(12)}The final sentence.`,
      "/tastings/42",
    );

    expect(html).toContain("Read more");
    expect(html).toContain('href="/tastings/42"');
    expect(html).toContain(
      'aria-label="Read the full tasting notes for Lagavulin 16-year-old"',
    );
    expect(html).not.toContain("The final sentence.");
  });

  it("shows the full tasting notes when no details link is provided", () => {
    const notes = `${"Smoke, fruit, and sea salt. ".repeat(12)}The final sentence.`;
    const html = renderNotes(notes);

    expect(html).toContain("The final sentence.");
    expect(html).not.toContain("Read more");
  });

  it("omits missing tasting notes and shows the recorded details", () => {
    const html = renderToStaticMarkup(
      <TastingEntry
        author="peatfan"
        date="Today"
        members={[
          {
            color: "Deep gold",
            comments: 4,
            imageKind: "photo",
            imageUrl: "/tasting.jpg",
            name: "Springbank 15",
            ratingBand: "outstanding",
            servingStyle: "Neat",
            tags: ["wax", "coal smoke"],
            tastingId: 42,
          },
        ]}
      />,
    );

    expect(html).toContain('src="/tasting.jpg"');
    expect(html).not.toContain("No notes.");
    expect(html).toContain("wax");
    expect(html).toContain("Neat");
    expect(html).toContain("Deep gold");
    expect(html).toContain('href="/tastings/42#comments"');
    expect(html).toContain("4 comments");
  });
});

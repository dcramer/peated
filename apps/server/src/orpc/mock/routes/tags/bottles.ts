import { mockBottles, mockTastings } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";
import type { TagCategory } from "@peated/server/types";

const categoryNotes = {
  cereal: [],
  fruit: [
    "apple",
    "dried fruit",
    "orange peel",
    "pear",
    "lemon",
    "peach",
    "coconut",
  ],
  floral: ["mint"],
  smoke: ["smoke", "sea salt", "mineral", "peat", "brine"],
  earthy: ["walnut"],
  sulfur: [],
  sweet: ["caramel", "vanilla", "honey"],
  spice: ["ginger", "allspice", "pepper"],
  wood: ["oak", "incense"],
} satisfies Record<TagCategory, string[]>;

export default mockOS.tags.bottles.handler(({ input }) => {
  const notes: string[] = categoryNotes[input.category];
  const selected = input.note
    ? notes.filter((note) => note === input.note?.toLowerCase())
    : notes;
  const results = mockBottles
    .map((bottle) => {
      const tastings = mockTastings.filter(
        (tasting) => tasting.bottle.id === bottle.id && tasting.tags.length,
      );
      return {
        bottle,
        matchingTastings: tastings.filter((tasting) =>
          tasting.tags.some((tag) => selected.includes(tag)),
        ).length,
        taggedTastings: tastings.length,
      };
    })
    .filter((result) => result.matchingTastings > 0)
    .sort(
      (a, b) =>
        b.matchingTastings / b.taggedTastings -
          a.matchingTastings / a.taggedTastings ||
        b.matchingTastings - a.matchingTastings ||
        a.bottle.id - b.bottle.id,
    );
  return { results: results.slice(0, input.limit) };
});

import { mockBottles, mockTastings } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import OblongTastingPhoto from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/exclusive-malts-islay-2007.jpg";
import SquareTastingPhoto from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/compass-box-spice-tree-extravaganza.webp";
import { getTastingTableItems } from "../lib/tastingTable";
import { StoryCanvas } from "./storyFixtures.stylex";
import { TastingTable } from "./tastingTable.stylex";

const [first, second, third, fourth, fifth] = mockTastings;

const items = getTastingTableItems([
  { ...first!, imageUrl: SquareTastingPhoto.src },
  {
    ...second!,
    imageUrl: OblongTastingPhoto.src,
    notes:
      "Dried apricot, orange peel, and ginger up front. The oak turns pleasantly dry, then a long, slightly waxy finish with more stone fruit than I expected and a little leather once it sits in the glass.",
  },
  {
    ...third!,
    bottle: {
      ...mockBottles[2]!,
      name: "Private Collection Clynelish 1972 50-year-old Refill Sherry Butt",
    },
    notes: null,
  },
  { ...fourth!, ratingBand: null },
  { ...fifth!, bottle: { ...mockBottles[4]!, abv: null } },
]);

const meta = {
  title: "Components/Reviews & Tastings/Tasting Table",
  component: TastingTable,
  parameters: {
    docs: {
      description: {
        component:
          "Dense table of one member's tastings, the compact alternative to Community Feed on a member's Tastings tab. Each row links to its tasting. The first line holds the date, a compact bottle identity, ABV, and rating; the note follows on one truncated line under the bottle. Narrow screens hide the date and ABV columns and show the date before the note. Unknown ABV and unrated tastings leave their cells empty. Map API tastings with getTastingTableItems.",
      },
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    caption: "dcramer's tastings",
    items,
  },
} satisfies Meta<typeof TastingTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

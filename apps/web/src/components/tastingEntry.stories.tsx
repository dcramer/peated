import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { RowMenu } from "./rowMenu.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { TastingEntry } from "./tastingEntry.stylex";

const meta = {
  title: "Components/Reviews & Tastings/Tasting Entry",
  component: TastingEntry,
  args: {
    author: "David Cramer",
    context: "At home with two friends",
    date: "August 24, 2026",
    members: [
      {
        href: "/bottles/lagavulin-16",
        imageUrl: BottleImage.src,
        bottle: {
          name: "Lagavulin 16-year-old",
          provenance: [{ name: "Single Malt" }],
          metadata: ["16 years", "43% ABV"],
        },
        ratingBand: "outstanding",
        tags: ["Smoke", "Dried fruit", "Sea salt"],
      },
      {
        href: "/bottles/ardbeg-uigeadail",
        bottle: {
          name: "Ardbeg Uigeadail",
          provenance: [{ name: "Single Malt" }],
          metadata: ["NAS", "54.2% ABV"],
        },
        ratingBand: "good",
        tags: ["Tar", "Raisin", "Espresso"],
      },
    ],
    menu: (
      <RowMenu
        groups={[[{ label: "Edit sitting", onSelect: () => undefined }]]}
        label="August 24 tasting"
      />
    ),
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof TastingEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <ItemList ariaLabel="Tasting entry examples">
        <ItemListItem>
          <TastingEntry {...args} />
        </ItemListItem>
        <ItemListItem>
          <TastingEntry
            {...args}
            comment="A classic benchmark. The smoke never crowds out the fruit."
            context={undefined}
            members={[
              {
                href: "/bottles/lagavulin-16",
                bottle: {
                  name: "Lagavulin 16-year-old",
                  provenance: [{ name: "Single Malt" }],
                  metadata: ["16 years", "43% ABV"],
                },
                ratingBand: "outstanding",
              },
            ]}
          />
        </ItemListItem>
      </ItemList>
    </StoryStack>
  ),
};

export const LongNotes: Story = {
  args: {
    members: [
      {
        notes:
          "The nose starts with wood smoke, dried orange, and old leather before moving into dark chocolate and sea salt. The palate adds roasted coffee, black pepper, and a little raisin sweetness. With time, the smoke softens and more fruit comes through. The finish is long, dry, and smoky, with espresso and orange peel lingering after the last sip.",
        notesHref: "/tastings/42",
        href: "/bottles/lagavulin-16",
        bottle: {
          name: "Lagavulin 16-year-old",
          provenance: [{ name: "Single Malt" }],
          metadata: ["16 years", "43% ABV"],
        },
        ratingBand: "outstanding",
        tags: ["Smoke", "Dried fruit", "Sea salt"],
      },
    ],
  },
};

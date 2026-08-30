import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { RowMenu } from "./rowMenu.stylex";
import { TastingEntry } from "./tastingEntry.stylex";

const meta = {
  title: "Components/Data Display/Tasting Entry",
  component: TastingEntry,
  args: {
    author: "David Cramer",
    context: "At home with two friends",
    date: "August 24, 2026",
    members: [
      {
        href: "/bottles/lagavulin-16",
        metadata: "Islay · 16 years · 43% ABV",
        name: "Lagavulin 16-year-old",
        notes: ["Smoke", "Dried fruit", "Sea salt"],
        ratingBand: "outstanding",
      },
      {
        href: "/bottles/ardbeg-uigeadail",
        metadata: "Islay · NAS · 54.2% ABV",
        name: "Ardbeg Uigeadail",
        notes: ["Tar", "Raisin", "Espresso"],
        ratingBand: "good",
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
                metadata: "Islay · 16 years · 43% ABV",
                name: "Lagavulin 16-year-old",
                ratingBand: "outstanding",
              },
            ]}
          />
        </ItemListItem>
      </ItemList>
      <TastingEntry {...args} surface />
    </StoryStack>
  ),
};

export const LongDescription: Story = {
  args: {
    members: [
      {
        description:
          "The nose starts with wood smoke, dried orange, and old leather before moving into dark chocolate and sea salt. The palate adds roasted coffee, black pepper, and a little raisin sweetness. With time, the smoke softens and more fruit comes through. The finish is long, dry, and smoky, with espresso and orange peel lingering after the last sip.",
        descriptionHref: "/tastings/42",
        href: "/bottles/lagavulin-16",
        metadata: "Islay · 16 years · 43% ABV",
        name: "Lagavulin 16-year-old",
        notes: ["Smoke", "Dried fruit", "Sea salt"],
        ratingBand: "outstanding",
      },
    ],
  },
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
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
        verdict: "savor",
      },
      {
        href: "/bottles/ardbeg-uigeadail",
        metadata: "Islay · NAS · 54.2% ABV",
        name: "Ardbeg Uigeadail",
        notes: ["Tar", "Raisin", "Espresso"],
        verdict: "sip",
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

export const Sitting: Story = {};

export const SingleBottle: Story = {
  args: {
    comment: "A classic benchmark. The smoke never crowds out the fruit.",
    context: undefined,
    members: [
      {
        href: "/bottles/lagavulin-16",
        metadata: "Islay · 16 years · 43% ABV",
        name: "Lagavulin 16-year-old",
        verdict: "savor",
      },
    ],
  },
};

export const FeedCard: Story = {
  args: {
    surface: true,
  },
};
